import type {
  ComposedBookDTO,
  ComposedBookDeviceOptionDTO,
  ComposedBookEvidenceDTO,
  DeviceBookEntryDTO,
  ScanStoerungResultDTO,
  TenantContext,
} from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { actorFromTenant } from "@/lib/auth/actorContext";
import { badRequest, notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import type {
  CreateBookEntryInput,
  ReportMalfunctionInput,
  UploadDeviceBookIfuInput,
} from "@/schemas/k10";
import { encodeOutOfServiceConsequence } from "@/services/scan/scanPrimaryAction";
import { modelDocumentService } from "@/services/catalog/modelDocumentService";
import {
  isMpbetreibV34BookException,
  parseCharacteristicsJson,
} from "@/services/registration/bookException";
import { evidenceService } from "@/services/registration/evidenceService";
import {
  assertDeviceInWorkAreas,
  getEffectiveAreaScope,
} from "@/services/users/userAreaScope";
import { recordedByAttribution } from "@/lib/auth/attribution";

/** Prerequisite codes that mean Gebrauchsanweisung / IFU (§ 4). */
export const IFU_PREREQUISITE_CODES = ["ga", "ifu", "gebrauchsanweisung"] as const;

function isoDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function mapEvidence(row: {
  id: string;
  prerequisiteCode: string;
  evidenceKind: string;
  attachmentBlobId: string | null;
  externalRecordRef: string | null;
  recordedBy: string;
  recordedAt: Date;
  attachmentBlob?: { contentType: string | null } | null;
}): ComposedBookEvidenceDTO {
  return {
    id: row.id,
    prerequisiteCode: row.prerequisiteCode,
    evidenceKind: row.evidenceKind,
    attachmentBlobId: row.attachmentBlobId,
    contentType: row.attachmentBlob?.contentType ?? null,
    source: "device_evidence",
    openUrl: row.attachmentBlobId ? `/api/attachments/${row.attachmentBlobId}` : null,
    externalRecordRef: row.externalRecordRef,
    recordedBy: row.recordedBy,
    recordedAt: row.recordedAt.toISOString(),
  };
}

function mapEntry(row: {
  id: string;
  deviceInstanceId: string;
  kind: DeviceBookEntryDTO["kind"];
  occurredAt: Date;
  description: string;
  consequence: string | null;
  repeatCount: number | null;
  incidentId: string | null;
  correctsEntryId: string | null;
  recordedBy: string;
  recordedAt: Date;
  deviceInstance?: { inventoryNumber: string } | null;
}): DeviceBookEntryDTO {
  return {
    id: row.id,
    deviceInstanceId: row.deviceInstanceId,
    inventoryNumber: row.deviceInstance?.inventoryNumber ?? null,
    kind: row.kind,
    occurredAt: isoDate(row.occurredAt)!,
    description: row.description,
    consequence: row.consequence,
    repeatCount: row.repeatCount,
    incidentId: row.incidentId,
    correctsEntryId: row.correctsEntryId,
    recordedBy: row.recordedBy,
    recordedAt: row.recordedAt.toISOString(),
  };
}

export const deviceBookService = {
  async list(ctx: TenantContext, deviceInstanceId?: string): Promise<DeviceBookEntryDTO[]> {
    requirePermission(ctx, "devicebook:view");
    const scope = await getEffectiveAreaScope(ctx);
    if (scope.mode === "none") return [];
    if (deviceInstanceId) {
      const device = await prisma.deviceInstance.findFirst({
        where: { id: deviceInstanceId },
        select: { areaId: true },
      });
      if (!device) return [];
      await assertDeviceInWorkAreas(ctx, device.areaId);
    }
    const rows = await prisma.deviceBookEntry.findMany({
      where: {
        ...(deviceInstanceId ? { deviceInstanceId } : {}),
        ...(scope.mode === "areas"
          ? { deviceInstance: { areaId: { in: scope.areaIds } } }
          : {}),
      },
      include: { deviceInstance: { select: { inventoryNumber: true } } },
      orderBy: [{ occurredAt: "desc" }, { recordedAt: "desc" }],
      take: 500,
    });
    return rows.map(mapEntry);
  },

  /** Append-only — corrections reference correctsEntryId; no update/delete. */
  async create(ctx: TenantContext, input: CreateBookEntryInput): Promise<DeviceBookEntryDTO> {
    requirePermission(ctx, "devicebook:view");
    const device = await prisma.deviceInstance.findFirst({ where: { id: input.deviceInstanceId } });
    if (!device) throw notFound("Device not found");
    await assertDeviceInWorkAreas(ctx, device.areaId);

    if (input.correctsEntryId) {
      const prior = await prisma.deviceBookEntry.findFirst({ where: { id: input.correctsEntryId } });
      if (!prior) throw badRequest("Corrected entry not found");
      if (prior.deviceInstanceId !== input.deviceInstanceId) {
        throw badRequest("Correction must target the same device");
      }
    }

    const row = await prisma.deviceBookEntry.create({
      data: {
        tenantId: ctx.tenantId,
        deviceInstanceId: input.deviceInstanceId,
        kind: input.kind,
        occurredAt: new Date(`${input.occurredAt}T00:00:00.000Z`),
        description: input.description,
        consequence: input.consequence ?? null,
        repeatCount: input.repeatCount ?? null,
        incidentId: input.incidentId ?? null,
        correctsEntryId: input.correctsEntryId ?? null,
        ...recordedByAttribution(ctx),
      },
      include: { deviceInstance: { select: { inventoryNumber: true } } },
    });

    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "DeviceBookEntry",
      resourceId: row.id,
      action: "create",
      summary: `Book entry ${row.kind} for ${device.inventoryNumber}`,
      after: { kind: row.kind, deviceInstanceId: row.deviceInstanceId },
    });

    return mapEntry(row);
  },

  /**
   * Scan Störung melden: DeviceBookEntry always; DeviceIncident (unassessed)
   * when harm ≠ no. Does not set suspectedSerious — MPSB assesses later.
   */
  async reportMalfunction(
    ctx: TenantContext,
    input: ReportMalfunctionInput,
  ): Promise<ScanStoerungResultDTO> {
    requirePermission(ctx, "devicebook:view");
    const device = await prisma.deviceInstance.findFirst({
      where: { id: input.deviceInstanceId },
      select: { id: true, areaId: true, inventoryNumber: true, modelId: true },
    });
    if (!device) throw notFound("Device not found");
    await assertDeviceInWorkAreas(ctx, device.areaId);

    if (input.harm === "yes" && input.outOfService === "no" && !input.consequence?.trim()) {
      throw unprocessable(
        "Harm affirmed while device stays in service requires a consequence note.",
        { field: "consequence" },
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    if (input.occurredAt > today) {
      throw unprocessable("Date cannot be in the future.", { field: "occurredAt" });
    }

    const outOfService = input.outOfService === "yes";
    const consequence = encodeOutOfServiceConsequence(input.consequence, outOfService);

    const result = await prisma.$transaction(async (tx) => {
      let incidentId: string | null = null;
      if (input.harm !== "no") {
        const incident = await tx.deviceIncident.create({
          data: {
            tenantId: ctx.tenantId,
            deviceInstanceId: device.id,
            deviceModelId: device.modelId,
            occurredAt: new Date(`${input.occurredAt}T00:00:00.000Z`),
            noticedAt: new Date(`${input.occurredAt}T00:00:00.000Z`),
            description: input.description,
            harmDescription: input.harm === "unknown" ? "Unklar — von Anwender gemeldet" : null,
            measureTaken: input.consequence?.trim() || null,
            suspectedSerious: null,
            ...recordedByAttribution(ctx),
          },
        });
        incidentId = incident.id;
      }

      const entry = await tx.deviceBookEntry.create({
        data: {
          tenantId: ctx.tenantId,
          deviceInstanceId: device.id,
          kind: input.kind,
          occurredAt: new Date(`${input.occurredAt}T00:00:00.000Z`),
          description: input.description,
          consequence,
          incidentId,
          ...recordedByAttribution(ctx),
        },
      });

      return { entryId: entry.id, incidentId };
    });

    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "DeviceBookEntry",
      resourceId: result.entryId,
      action: "create",
      summary: `Störung ${input.kind} for ${device.inventoryNumber}${result.incidentId ? " + incident draft" : ""}`,
      after: {
        kind: input.kind,
        harm: input.harm,
        outOfService,
        incidentId: result.incidentId,
      },
    });

    return {
      entryId: result.entryId,
      incidentId: result.incidentId,
      inventoryNumber: device.inventoryNumber,
      kind: input.kind,
      outOfService,
      harm: input.harm,
    };
  },

  /**
   * Devices subject to § 13 book (Anlage 1 STK or Anlage 2 MTK), non-draft.
   * Excludes § 3 Abs. 4 book exceptions (Kompaktthermometer / Hg|aneroid manometer).
   */
  async listBookableDevices(ctx: TenantContext): Promise<ComposedBookDeviceOptionDTO[]> {
    requirePermission(ctx, "devicebook:view");
    const scope = await getEffectiveAreaScope(ctx);
    if (scope.mode === "none") return [];

    const rows = await prisma.deviceInstance.findMany({
      where: {
        state: { not: "draft" },
        ...(scope.mode === "areas" ? { areaId: { in: scope.areaIds } } : {}),
        model: {
          classifications: {
            some: {
              validTo: null,
              OR: [{ stk: true }, { mtkItemId: { not: null } }],
            },
          },
        },
      },
      select: {
        id: true,
        inventoryNumber: true,
        serialNumber: true,
        udiDi: true,
        room: true,
        state: true,
        characteristicsJson: true,
        modelId: true,
        model: {
          select: {
            id: true,
            modelName: true,
            tradeName: true,
            manufacturer: true,
            basicUdiDi: true,
            udiDi: true,
            gtins: true,
            documents: {
              where: { kind: "ifu", supersededAt: null },
              select: { id: true },
              take: 1,
            },
          },
        },
        area: { select: { name: true, site: { select: { name: true } } } },
        evidence: {
          where: { prerequisiteCode: { in: [...IFU_PREREQUISITE_CODES] } },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { inventoryNumber: "asc" },
      take: 500,
    });

    return rows
      .filter((r) => !isMpbetreibV34BookException(parseCharacteristicsJson(r.characteristicsJson)))
      .map((r) => ({
        id: r.id,
        inventoryNumber: r.inventoryNumber,
        name: r.model?.tradeName || r.model?.modelName || r.inventoryNumber,
        manufacturer: r.model?.manufacturer ?? null,
        serialNumber: r.serialNumber,
        modelName: r.model?.modelName ?? null,
        basicUdiDi: r.model?.basicUdiDi ?? null,
        udiDi: r.udiDi || r.model?.udiDi || null,
        gtins: r.model?.gtins ?? null,
        areaName: r.area?.name ?? null,
        siteName: r.area?.site?.name ?? null,
        room: r.room,
        state: r.state,
        hasIfu: r.evidence.length > 0 || (r.model?.documents.length ?? 0) > 0,
      }));
  },

  /** Aggregate § 13 Abs. 2 from existing sources for one device. */
  async getComposed(ctx: TenantContext, deviceInstanceId: string): Promise<ComposedBookDTO> {
    requirePermission(ctx, "devicebook:view");
    const device = await prisma.deviceInstance.findFirst({
      where: { id: deviceInstanceId },
      include: {
        model: {
          select: {
            id: true,
            modelName: true,
            tradeName: true,
            manufacturer: true,
            basicUdiDi: true,
            udiDi: true,
          },
        },
        area: { select: { name: true, site: { select: { name: true } } } },
      },
    });
    if (!device) throw notFound("Device not found");
    await assertDeviceInWorkAreas(ctx, device.areaId);

    const deviceLabel =
      device.model?.tradeName || device.model?.modelName || device.inventoryNumber;

    const [duties, trainings, entries, incidents, evidenceRows, modelIfu] = await Promise.all([
      prisma.deviceDuty.findMany({
        where: { deviceInstanceId, applicable: true, suspendedAt: null },
        include: {
          performances: {
            orderBy: { performedAt: "desc" },
            take: 1,
            select: { performedBy: true, performedAt: true },
          },
        },
        orderBy: [{ dutyKey: "asc" }, { dueAt: "asc" }],
      }),
      device.modelId
        ? prisma.trainingEvent.findMany({
            where: { subjectModelId: device.modelId },
            include: {
              trainingType: { select: { label: true } },
              records: {
                include: { person: { select: { name: true } } },
              },
            },
            orderBy: { heldOn: "desc" },
            take: 50,
          })
        : Promise.resolve([]),
      this.list(ctx, deviceInstanceId),
      prisma.deviceIncident.findMany({
        where: { deviceInstanceId },
        include: { deviceInstance: { select: { inventoryNumber: true } } },
        orderBy: [{ occurredAt: "desc" }],
        take: 100,
      }),
      prisma.deviceEvidence.findMany({
        where: {
          deviceInstanceId,
          prerequisiteCode: { in: [...IFU_PREREQUISITE_CODES] },
        },
        include: { attachmentBlob: { select: { contentType: true } } },
        orderBy: { recordedAt: "desc" },
      }),
      modelDocumentService.currentIfuForModel(ctx, device.modelId),
    ]);

    return {
      device: {
        id: device.id,
        inventoryNumber: device.inventoryNumber,
        name: deviceLabel,
        manufacturer: device.model?.manufacturer ?? null,
        modelName: device.model?.modelName ?? null,
        tradeName: device.model?.tradeName ?? null,
        serialNumber: device.serialNumber,
        state: device.state,
        basicUdiDi: device.model?.basicUdiDi ?? null,
        udiDi: device.udiDi || device.model?.udiDi || null,
        areaName: device.area?.name ?? null,
        siteName: device.area?.site?.name ?? null,
        room: device.room,
        modelId: device.modelId,
      },
      evidence: evidenceRows.map(mapEvidence),
      modelIfu,
      duties: duties.map((d) => ({
        dutyKey: d.dutyKey,
        title: d.title ?? d.dutyKey,
        basisText: d.basisText,
        lastCompletedAt: isoDate(d.lastCompletedAt),
        dueAt: isoDate(d.dueAt),
        lastPerformedBy: d.performances[0]?.performedBy ?? null,
      })),
      trainings: trainings.map((t) => ({
        heldOn: isoDate(t.heldOn)!,
        trainingType: t.trainingType.label,
        instructorName: t.instructorName,
        participants: t.records.map((r) => r.person.name),
      })),
      entries,
      incidents: incidents.map((row) => ({
        id: row.id,
        deviceInstanceId: row.deviceInstanceId,
        inventoryNumber: row.deviceInstance?.inventoryNumber ?? null,
        deviceLabel: null,
        deviceModelId: row.deviceModelId,
        occurredAt: isoDate(row.occurredAt)!,
        noticedAt: isoDate(row.noticedAt)!,
        description: row.description,
        harmDescription: row.harmDescription,
        suspectedSerious: row.suspectedSerious,
        assessedBy: row.assessedBy,
        assessedAt: isoDate(row.assessedAt),
        assessmentNote: row.assessmentNote,
        reportedAt: isoDate(row.reportedAt),
        reportReference: row.reportReference,
        reportedTo: row.reportedTo,
        manufacturerNotifiedAt: isoDate(row.manufacturerNotifiedAt),
        measureTaken: row.measureTaken,
        closedAt: isoDate(row.closedAt),
        closedBy: row.closedBy,
        recordedBy: row.recordedBy,
        recordedAt: row.recordedAt.toISOString(),
        assignedUserId: row.assignedUserId,
        assignedUserName: row.assignedUserName,
        assignedAt: row.assignedAt?.toISOString() ?? null,
        assignmentDueAt: isoDate(row.assignmentDueAt),
      })),
    };
  },

  /**
   * Upload IFU: instance DeviceEvidence (accessibility) + when model-linked and
   * user can update catalog, also publish ModelDocument (Bauart).
   */
  async uploadIfu(ctx: TenantContext, input: UploadDeviceBookIfuInput): Promise<ComposedBookEvidenceDTO> {
    requirePermission(ctx, "devicebook:view");
    requirePermission(ctx, "inventory:update");
    const device = await prisma.deviceInstance.findFirst({
      where: { id: input.deviceInstanceId },
      select: { id: true, areaId: true, state: true, modelId: true },
    });
    if (!device) throw notFound("Device not found");
    if (device.state === "draft") throw unprocessable("Draft devices have no book yet.");
    await assertDeviceInWorkAreas(ctx, device.areaId);

    const result = await evidenceService.upsert(ctx, input.deviceInstanceId, {
      prerequisiteCode: "ifu",
      evidenceKind: input.dataUrl?.trim() ? "document" : "third_party",
      dataUrl: input.dataUrl,
      externalRecordRef: input.externalRecordRef,
    });

    const canPublishModel =
      Boolean(device.modelId) &&
      (ctx.permissions?.includes("catalog:update") ||
        ctx.user.role === "device_admin" ||
        ctx.user.role === "superadmin");

    if (canPublishModel && device.modelId && (input.dataUrl?.trim() || input.externalRecordRef?.trim())) {
      try {
        await modelDocumentService.publish(ctx, {
          deviceModelId: device.modelId,
          kind: "ifu",
          revisionLabel: `book-${new Date().toISOString().slice(0, 10)}`,
          language: "de",
          dataUrl: input.dataUrl,
          externalUrl: input.externalRecordRef,
        });
      } catch {
        // Instance evidence remains; model publish is best-effort when catalog grant missing.
      }
    }

    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "DeviceEvidence",
      resourceId: result.id,
      action: "upload_ifu",
      summary: `IFU for device ${input.deviceInstanceId}`,
    });

    const row = await prisma.deviceEvidence.findFirst({
      where: { id: result.id },
      include: { attachmentBlob: { select: { contentType: true } } },
    });
    if (!row) throw notFound("Evidence not found after upload");
    return mapEvidence(row);
  },
};
