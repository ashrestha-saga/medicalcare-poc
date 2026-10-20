import type {
  ScanChargeDetailDTO,
  ScanChargeListDTO,
  ScanChargeListItemDTO,
  ScanChargeReleaseResultDTO,
  TenantContext,
} from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { actorFromTenant } from "@/lib/auth/actorContext";
import { recordedByAttribution } from "@/lib/auth/attribution";
import { badRequest, forbidden, notFound, unprocessable } from "@/lib/errors";
import { blobMetaFromDataUrl } from "@/lib/blobMeta";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import { isReprocessingEquipmentDevice } from "@/services/registration/reprocessingLinkService";
import type {
  AttachScanChargeBelegInput,
  CreateScanChargeInput,
  ReleaseScanChargeInput,
} from "@/schemas/k10";
import { assertDeviceInWorkAreas, getEffectiveAreaScope } from "@/services/users/userAreaScope";
import { evaluateWithinLimit } from "./scanRoutineService";
import { consequenceMeansOutOfService } from "./scanPrimaryAction";
import { createHash } from "node:crypto";

function startOfTodayUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

function sha256HexFromDataUrl(dataUrl: string): string | null {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const payload = dataUrl.slice(comma + 1);
  const isBase64 = /;base64/i.test(dataUrl.slice(0, comma + 1));
  try {
    const buf = isBase64
      ? Buffer.from(payload.replace(/\s/g, ""), "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8");
    return createHash("sha256").update(buf).digest("hex");
  } catch {
    return null;
  }
}

async function assertSachkunde(ctx: TenantContext): Promise<void> {
  const today = startOfTodayUtc();
  const catalog = await prisma.refQualification.findMany({
    where: {
      OR: [
        { code: { startsWith: "sachkunde" } },
        { code: { contains: "sachkunde" } },
        { label: { contains: "Sachkunde" } },
      ],
    },
    select: { code: true },
    take: 20,
  });
  if (catalog.length === 0) {
    // Catalogue not seeded yet — permission reprocessing:release is the gate.
    return;
  }
  const codes = catalog.map((c) => c.code);
  const held = await prisma.personQualification.findFirst({
    where: {
      userId: ctx.user.id,
      qualificationCode: { in: codes },
      OR: [{ validUntil: null }, { validUntil: { gte: today } }],
    },
    select: { id: true },
  });
  if (!held) {
    throw forbidden("Batch release requires Sachkunde (PersonQualification).");
  }
}

async function deviceBlockedByStoerung(deviceId: string): Promise<string | null> {
  const book = await prisma.deviceBookEntry.findMany({
    where: { deviceInstanceId: deviceId },
    orderBy: [{ occurredAt: "desc" }],
    take: 10,
    select: { consequence: true, description: true, occurredAt: true },
  });
  for (const b of book) {
    if (consequenceMeansOutOfService(b.consequence)) {
      return `Gerät gesperrt — Außer Betrieb seit ${b.occurredAt.toISOString().slice(0, 10)}: ${b.description}`;
    }
  }
  return null;
}

async function routineFailedToday(deviceId: string): Promise<string | null> {
  const today = startOfTodayUtc();
  const failed = await prisma.reprocessingCheck.findFirst({
    where: {
      equipmentDeviceId: deviceId,
      performedAt: today,
      OR: [{ passed: false }, { withinLimit: false }],
    },
    select: { note: true, checkCode: true },
  });
  if (failed) {
    return `Tageskontrolle heute nicht bestanden (${failed.checkCode})`;
  }
  return null;
}

function mapListItem(r: {
  id: string;
  batchNumber: string;
  programme: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  releaseResult: string | null;
  processRecordBlobId: string | null;
  processRecordRef: string | null;
  equipmentDeviceId: string;
  equipmentDevice: { inventoryNumber: string; model: { tradeName: string | null; modelName: string | null } | null };
}): ScanChargeListItemDTO {
  return {
    id: r.id,
    batchNumber: r.batchNumber,
    programme: r.programme,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
    releaseResult: r.releaseResult as ScanChargeListItemDTO["releaseResult"],
    hasBeleg: Boolean(r.processRecordBlobId || r.processRecordRef),
    equipmentDeviceId: r.equipmentDeviceId,
    inventoryNumber: r.equipmentDevice.inventoryNumber,
    label:
      r.equipmentDevice.model?.tradeName?.trim() ||
      r.equipmentDevice.model?.modelName?.trim() ||
      r.equipmentDevice.inventoryNumber,
  };
}

export const scanChargeService = {
  async listOpen(ctx: TenantContext, equipmentDeviceId?: string): Promise<ScanChargeListDTO> {
    requirePermission(ctx, "reprocessing:view");
    const scope = await getEffectiveAreaScope(ctx);
    if (scope.mode === "none") return { items: [] };
    if (equipmentDeviceId) {
      const d = await prisma.deviceInstance.findFirst({
        where: { id: equipmentDeviceId },
        select: { areaId: true },
      });
      if (!d) throw notFound("Device not found");
      await assertDeviceInWorkAreas(ctx, d.areaId);
    }
    const rows = await prisma.reprocessingBatch.findMany({
      where: {
        releaseResult: null,
        ...(equipmentDeviceId ? { equipmentDeviceId } : {}),
        ...(scope.mode === "areas"
          ? { equipmentDevice: { areaId: { in: scope.areaIds } } }
          : {}),
      },
      include: {
        equipmentDevice: {
          select: {
            inventoryNumber: true,
            model: { select: { tradeName: true, modelName: true } },
          },
        },
      },
      orderBy: { startedAt: "desc" },
      take: 100,
    });
    return { items: rows.map(mapListItem) };
  },

  async get(ctx: TenantContext, batchId: string): Promise<ScanChargeDetailDTO> {
    requirePermission(ctx, "reprocessing:view");
    const row = await prisma.reprocessingBatch.findFirst({
      where: { id: batchId },
      include: {
        equipmentDevice: {
          select: {
            id: true,
            inventoryNumber: true,
            areaId: true,
            productKindCode: true,
            characteristicsJson: true,
            model: { select: { tradeName: true, modelName: true } },
          },
        },
        processRecordBlob: { select: { id: true, sha256: true, byteSize: true, kind: true } },
        items: true,
        _count: { select: { items: true } },
      },
    });
    if (!row) throw notFound("Batch not found");
    await assertDeviceInWorkAreas(ctx, row.equipmentDevice.areaId);

    const hurdles: string[] = [];
    if (!row.releaseResult) {
      const blocked = await deviceBlockedByStoerung(row.equipmentDeviceId);
      if (blocked) hurdles.push(blocked);
      const routine = await routineFailedToday(row.equipmentDeviceId);
      if (routine) hurdles.push(routine);
      if (!row.processRecordBlobId && !row.processRecordRef) {
        hurdles.push("Prozessprotokoll des Geräts fehlt als Beleg");
      }
      try {
        await assertSachkunde(ctx);
      } catch {
        hurdles.push("Freigabe setzt Sachkunde voraus");
      }
      if (!ctx.permissions?.includes("reprocessing:release")) {
        hurdles.push("Berechtigung reprocessing:release fehlt");
      }
    }

    const typeCode = (() => {
      try {
        const c = JSON.parse(row.equipmentDevice.characteristicsJson || "{}") as {
          eigenTyp?: string;
        };
        return c.eigenTyp?.trim() || null;
      } catch {
        return null;
      }
    })();

    const perBatchRefs = await prisma.refReprocessingCheck.findMany({
      where: {
        cadence: "per_batch",
        scope: "equipment",
        ...(typeCode ? { equipmentTypeCode: typeCode } : {}),
      },
      orderBy: { code: "asc" },
    });

    return {
      id: row.id,
      batchNumber: row.batchNumber,
      programme: row.programme,
      loadPattern: row.loadPattern,
      startedAt: row.startedAt.toISOString(),
      finishedAt: row.finishedAt?.toISOString() ?? null,
      releaseResult: row.releaseResult,
      releaseNote: row.releaseNote,
      releasedBy: row.releasedBy,
      releasedById: row.releasedById,
      releasedAt: row.releasedAt?.toISOString() ?? null,
      equipmentDeviceId: row.equipmentDeviceId,
      inventoryNumber: row.equipmentDevice.inventoryNumber,
      label:
        row.equipmentDevice.model?.tradeName?.trim() ||
        row.equipmentDevice.model?.modelName?.trim() ||
        row.equipmentDevice.inventoryNumber,
      isEquipment: isReprocessingEquipmentDevice(row.equipmentDevice),
      beleg: row.processRecordBlob
        ? {
            blobId: row.processRecordBlob.id,
            sha256: row.processRecordBlob.sha256,
            byteSize: row.processRecordBlob.byteSize,
          }
        : row.processRecordRef
          ? { blobId: null, sha256: null, byteSize: null, ref: row.processRecordRef }
          : null,
      items: row.items.map((i) => ({
        label: i.label,
        quantity: i.quantity,
        deviceInstanceId: i.deviceInstanceId,
      })),
      hurdles,
      perBatchChecks: perBatchRefs.map((r) => ({
        checkCode: r.code,
        label: r.label,
        scope: r.scope,
        unit: r.unit,
        limitText: r.limitText,
        kind: r.unit ? ("measure" as const) : ("pass_fail" as const),
      })),
    };
  },

  async create(ctx: TenantContext, input: CreateScanChargeInput): Promise<ScanChargeDetailDTO> {
    requirePermission(ctx, "reprocessing:view");
    const device = await prisma.deviceInstance.findFirst({
      where: { id: input.equipmentDeviceId },
      select: {
        id: true,
        areaId: true,
        productKindCode: true,
        characteristicsJson: true,
      },
    });
    if (!device) throw notFound("Equipment device not found");
    await assertDeviceInWorkAreas(ctx, device.areaId);
    if (!isReprocessingEquipmentDevice(device)) {
      throw unprocessable(
        "Device is not reprocessing equipment. Needs product kind „Aufbereitungsgerät“ or Merkmale istAufbGeraet + eigenTyp (e.g. rdg).",
        { field: "equipmentDeviceId" },
      );
    }
    if (input.finishedAt <= input.startedAt) {
      throw unprocessable("End must be after start.", { field: "finishedAt" });
    }
    const items = input.items.filter((i) => i.label?.trim());
    if (items.length === 0) {
      throw unprocessable("Add at least one load item.", { field: "items" });
    }

    const clash = await prisma.reprocessingBatch.findFirst({
      where: {
        tenantId: ctx.tenantId,
        equipmentDeviceId: input.equipmentDeviceId,
        batchNumber: input.batchNumber.trim(),
      },
      select: { id: true },
    });
    if (clash) throw unprocessable("Batch number already exists on this device.", { field: "batchNumber" });

    const row = await prisma.reprocessingBatch.create({
      data: {
        tenantId: ctx.tenantId,
        equipmentDeviceId: input.equipmentDeviceId,
        batchNumber: input.batchNumber.trim(),
        programme: input.programme.trim(),
        startedAt: new Date(input.startedAt),
        finishedAt: new Date(input.finishedAt),
        loadPattern: input.loadPattern?.trim() || null,
        ...recordedByAttribution(ctx),
        items: {
          create: items.map((i) => ({
            tenantId: ctx.tenantId,
            label: i.label!.trim(),
            quantity: i.quantity ?? 1,
          })),
        },
      },
    });

    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "ReprocessingBatch",
      resourceId: row.id,
      action: "create",
      summary: `Scan charge ${row.batchNumber} (unreleased)`,
    });

    return this.get(ctx, row.id);
  },

  async attachBeleg(
    ctx: TenantContext,
    batchId: string,
    input: AttachScanChargeBelegInput,
  ): Promise<ScanChargeDetailDTO> {
    requirePermission(ctx, "reprocessing:view");
    const batch = await prisma.reprocessingBatch.findFirst({
      where: { id: batchId },
      include: { equipmentDevice: { select: { areaId: true } } },
    });
    if (!batch) throw notFound("Batch not found");
    if (batch.releaseResult) throw badRequest("Batch already released");
    await assertDeviceInWorkAreas(ctx, batch.equipmentDevice.areaId);

    const computed = sha256HexFromDataUrl(input.dataUrl);
    if (!computed) throw unprocessable("Invalid beleg data URL.", { field: "dataUrl" });
    if (input.sha256 && input.sha256.toLowerCase() !== computed) {
      throw unprocessable("SHA-256 mismatch — beleg rejected.", { field: "sha256" });
    }
    const meta = blobMetaFromDataUrl(input.dataUrl);
    const blob = await prisma.attachmentBlob.create({
      data: {
        tenantId: ctx.tenantId,
        kind: "process_record",
        dataUrl: input.dataUrl,
        contentType: meta.contentType,
        byteSize: meta.byteSize,
        sha256: computed,
      },
    });
    await prisma.reprocessingBatch.update({
      where: { id: batchId },
      data: { processRecordBlobId: blob.id },
    });
    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "ReprocessingBatch",
      resourceId: batchId,
      action: "update",
      summary: `Process record attached (sha256 ${computed.slice(0, 12)}…)`,
    });
    return this.get(ctx, batchId);
  },

  async release(
    ctx: TenantContext,
    batchId: string,
    input: ReleaseScanChargeInput,
  ): Promise<ScanChargeReleaseResultDTO> {
    requirePermission(ctx, "reprocessing:release");
    await assertSachkunde(ctx);

    if (!input.confirmSign) {
      throw unprocessable("Signature confirmation required.", { field: "confirmSign" });
    }

    const detail = await this.get(ctx, batchId);
    if (detail.releaseResult) throw badRequest("Batch already released or rejected");

    if (input.releaseResult !== "rejected" && detail.hurdles.length > 0) {
      throw forbidden(`Freigabe nicht möglich: ${detail.hurdles[0]}`);
    }

    if (input.releaseResult !== "released" && !input.releaseNote?.trim()) {
      throw unprocessable(
        input.releaseResult === "rejected"
          ? "Rejection requires a note."
          : "Conditional release requires a note.",
        { field: "releaseNote" },
      );
    }

    // Per-batch checks (optional structured values from beleg)
    let mangel = false;
    const answers = input.answers ?? [];
    for (const step of detail.perBatchChecks) {
      const a = answers.find((x) => x.checkCode === step.checkCode);
      if (!a) {
        if (input.releaseResult === "rejected") continue;
        throw unprocessable(`Missing per-batch check ${step.checkCode}`, { field: step.checkCode });
      }
      if (step.kind === "pass_fail") {
        if (a.passed !== true && a.passed !== false && input.releaseResult !== "rejected") {
          throw unprocessable(`Answer ${step.checkCode}`, { field: step.checkCode });
        }
        if (a.passed === false) mangel = true;
      } else {
        const within = evaluateWithinLimit(step.limitText, a.measuredValue);
        if (within === null && input.releaseResult !== "rejected") {
          throw unprocessable(`Enter value for ${step.checkCode}`, { field: step.checkCode });
        }
        if (within === false) mangel = true;
      }
    }
    if (mangel && input.releaseResult === "released") {
      throw unprocessable(
        "A per-batch check failed — release only with conditions or reject.",
        { field: "releaseResult" },
      );
    }

    const today = startOfTodayUtc();
    await prisma.$transaction(async (tx) => {
      for (const step of detail.perBatchChecks) {
        const a = answers.find((x) => x.checkCode === step.checkCode);
        if (!a) continue;
        const within =
          step.kind === "measure" ? evaluateWithinLimit(step.limitText, a.measuredValue) : null;
        await tx.reprocessingCheck.create({
          data: {
            tenantId: ctx.tenantId,
            checkCode: step.checkCode,
            equipmentDeviceId: detail.equipmentDeviceId,
            batchId,
            performedAt: today,
            performedBy: ctx.user.name,
            performedById: ctx.user.id,
            passed: step.kind === "pass_fail" ? (a.passed ?? null) : null,
            measuredValue: step.kind === "measure" ? (a.measuredValue?.trim() ?? null) : null,
            withinLimit: within,
            note: input.releaseNote?.trim() || null,
          },
        });
      }
      await tx.reprocessingBatch.update({
        where: { id: batchId },
        data: {
          releaseResult: input.releaseResult,
          releaseNote: input.releaseNote?.trim() || null,
          releasedBy: ctx.user.name,
          releasedById: ctx.user.id,
          releasedAt: new Date(),
          finishedAt: detail.finishedAt ? new Date(detail.finishedAt) : new Date(),
        },
      });
    });

    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "ReprocessingBatch",
      resourceId: batchId,
      action: "release",
      summary: `Scan charge ${detail.batchNumber} → ${input.releaseResult} (signed by ${ctx.user.id})`,
    });

    return {
      batchId,
      batchNumber: detail.batchNumber,
      inventoryNumber: detail.inventoryNumber,
      releaseResult: input.releaseResult,
      releasedBy: ctx.user.name,
      releasedAt: new Date().toISOString(),
      belegSha256: detail.beleg?.sha256 ?? null,
      releaseNote: input.releaseNote?.trim() || null,
    };
  },
};
