import type { FieldSafetyActionDTO, FieldSafetyAffectedModelDTO, TenantContext } from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { actorFromTenant } from "@/lib/auth/actorContext";
import { recordedByAttribution } from "@/lib/auth/attribution";
import { badRequest, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import type {
  AddFieldSafetyAffectedModelsInput,
  CreateFieldSafetyInput,
  CreateFieldSafetyWithDevicesInput,
  FieldSafetyAffectedModelInput,
  MatchFieldSafetyDeviceInput,
} from "@/schemas/k10";
import { filterCandidateDevices } from "@/services/fieldSafety/fieldSafetyCandidates";

function isoDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function modelLabel(m: {
  tradeName: string | null;
  modelName: string | null;
  manufacturer: string | null;
} | null): string | null {
  if (!m) return null;
  return m.tradeName || m.modelName || m.manufacturer || null;
}

type ActionRow = {
  id: string;
  reference: string;
  manufacturer: string;
  title: string;
  requiredAction: string;
  issuedAt: Date;
  receivedAt: Date;
  dueAt: Date | null;
  affectedScope: string;
  documentRef: string | null;
  closedAt: Date | null;
  recordedBy: string;
  recordedAt: Date;
  deviceActions: Array<{
    id: string;
    deviceInstanceId: string;
    affected: boolean | null;
    actionTakenAt: Date | null;
    actionNote: string | null;
    deviceInstance: { inventoryNumber: string };
  }>;
  affectedModels: Array<{
    id: string;
    deviceModelId: string | null;
    basicUdiDi: string | null;
    serialFrom: string | null;
    serialTo: string | null;
    lotNumber: string | null;
    note: string | null;
    deviceModel: {
      tradeName: string | null;
      modelName: string | null;
      manufacturer: string | null;
    } | null;
  }>;
};

function mapAffected(row: ActionRow["affectedModels"][number]): FieldSafetyAffectedModelDTO {
  return {
    id: row.id,
    deviceModelId: row.deviceModelId,
    modelLabel: modelLabel(row.deviceModel),
    basicUdiDi: row.basicUdiDi,
    serialFrom: row.serialFrom,
    serialTo: row.serialTo,
    lotNumber: row.lotNumber,
    note: row.note,
  };
}

function mapAction(row: ActionRow, suggestedCandidateCount = 0): FieldSafetyActionDTO {
  return {
    id: row.id,
    reference: row.reference,
    manufacturer: row.manufacturer,
    title: row.title,
    requiredAction: row.requiredAction,
    issuedAt: isoDate(row.issuedAt)!,
    receivedAt: isoDate(row.receivedAt)!,
    dueAt: isoDate(row.dueAt),
    affectedScope: row.affectedScope,
    documentRef: row.documentRef,
    closedAt: isoDate(row.closedAt),
    recordedBy: row.recordedBy,
    recordedAt: row.recordedAt.toISOString(),
    unmatchedCount: row.deviceActions.filter((d) => d.affected === null).length,
    pendingMeasureCount: row.deviceActions.filter(
      (d) => d.affected === true && d.actionTakenAt == null,
    ).length,
    deviceActions: row.deviceActions.map((d) => ({
      id: d.id,
      deviceInstanceId: d.deviceInstanceId,
      inventoryNumber: d.deviceInstance.inventoryNumber,
      affected: d.affected,
      actionTakenAt: isoDate(d.actionTakenAt),
      actionNote: d.actionNote,
    })),
    affectedModels: row.affectedModels.map(mapAffected),
    suggestedCandidateCount,
  };
}

const includeActions = {
  deviceActions: { include: { deviceInstance: { select: { inventoryNumber: true } } } },
  affectedModels: {
    include: {
      deviceModel: { select: { tradeName: true, modelName: true, manufacturer: true } },
    },
  },
} as const;

function normalizeAffectedModels(rows: FieldSafetyAffectedModelInput[]): FieldSafetyAffectedModelInput[] {
  return rows.filter(
    (r) =>
      r.deviceModelId ||
      r.basicUdiDi?.trim() ||
      r.serialFrom?.trim() ||
      r.serialTo?.trim() ||
      r.lotNumber?.trim(),
  );
}

async function findMatchingDeviceIds(
  tenantId: string,
  scopes: FieldSafetyAffectedModelInput[],
  excludeIds: string[],
): Promise<string[]> {
  if (scopes.length === 0) return [];

  const modelIds = scopes.map((s) => s.deviceModelId).filter(Boolean) as string[];
  const udis = scopes.map((s) => s.basicUdiDi?.trim()).filter(Boolean) as string[];
  const serialOnly = scopes.some((s) => !s.deviceModelId && !s.basicUdiDi?.trim());
  const orClauses = [
    ...(modelIds.length ? [{ modelId: { in: modelIds } }] : []),
    ...(udis.length ? [{ model: { basicUdiDi: { in: udis } } }] : []),
    ...(serialOnly ? [{ serialNumber: { not: null } }] : []),
  ];
  if (orClauses.length === 0) return [];

  const devices = await prisma.deviceInstance.findMany({
    where: {
      tenantId,
      state: { not: "draft" },
      ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
      OR: orClauses,
    },
    select: {
      id: true,
      modelId: true,
      serialNumber: true,
      model: { select: { basicUdiDi: true } },
    },
    take: 2000,
  });

  const candidates = filterCandidateDevices(
    devices.map((d) => ({
      id: d.id,
      modelId: d.modelId,
      serialNumber: d.serialNumber,
      modelBasicUdiDi: d.model?.basicUdiDi ?? null,
    })),
    scopes.map((s) => ({
      deviceModelId: s.deviceModelId ?? null,
      basicUdiDi: s.basicUdiDi ?? null,
      serialFrom: s.serialFrom ?? null,
      serialTo: s.serialTo ?? null,
    })),
  );
  return candidates.map((c) => c.id);
}

async function suggestedCountForAction(tenantId: string, row: ActionRow): Promise<number> {
  if (row.affectedModels.length === 0) return 0;
  const linked = row.deviceActions.map((d) => d.deviceInstanceId);
  const ids = await findMatchingDeviceIds(tenantId, row.affectedModels, linked);
  return ids.length;
}

export type FieldSafetyListView = "all" | "open" | "unmatched";

export const fieldSafetyService = {
  async list(
    ctx: TenantContext,
    view: FieldSafetyListView = "all",
    opts: { actionId?: string } = {},
  ): Promise<FieldSafetyActionDTO[]> {
    requirePermission(ctx, "fieldsafety:view");
    const where =
      opts.actionId
        ? { id: opts.actionId }
        : view === "open" || view === "unmatched"
          ? { closedAt: null }
          : {};
    const rows = await prisma.fieldSafetyAction.findMany({
      where,
      include: includeActions,
      orderBy: [{ dueAt: "asc" }, { receivedAt: "desc" }],
      take: 200,
    });
    const mapped = await Promise.all(
      rows.map(async (r) => mapAction(r, await suggestedCountForAction(ctx.tenantId, r))),
    );
    if (!opts.actionId && view === "unmatched") {
      return mapped.filter(
        (a) =>
          a.unmatchedCount > 0 ||
          a.pendingMeasureCount > 0 ||
          a.suggestedCandidateCount > 0,
      );
    }
    return mapped;
  },

  async create(
    ctx: TenantContext,
    input: CreateFieldSafetyInput | CreateFieldSafetyWithDevicesInput,
  ): Promise<FieldSafetyActionDTO> {
    requirePermission(ctx, "fieldsafety:create");
    const deviceIds =
      "deviceInstanceIds" in input && Array.isArray(input.deviceInstanceIds)
        ? [...new Set(input.deviceInstanceIds)]
        : [];
    const affectedModels = normalizeAffectedModels(
      "affectedModels" in input && Array.isArray(input.affectedModels) ? input.affectedModels : [],
    );

    if (deviceIds.length) {
      const found = await prisma.deviceInstance.findMany({
        where: { id: { in: deviceIds } },
        select: { id: true },
      });
      if (found.length !== deviceIds.length) throw notFound("One or more devices not found");
    }
    for (const m of affectedModels) {
      if (m.deviceModelId) {
        const model = await prisma.deviceModel.findFirst({ where: { id: m.deviceModelId } });
        if (!model) throw badRequest(`Unknown device model ${m.deviceModelId}`);
      }
    }

    const attr = recordedByAttribution(ctx);
    const row = await prisma.fieldSafetyAction.create({
      data: {
        tenantId: ctx.tenantId,
        reference: input.reference,
        manufacturer: input.manufacturer,
        title: input.title,
        requiredAction: input.requiredAction,
        issuedAt: new Date(`${input.issuedAt}T00:00:00.000Z`),
        receivedAt: new Date(`${input.receivedAt}T00:00:00.000Z`),
        dueAt: input.dueAt ? new Date(`${input.dueAt}T00:00:00.000Z`) : null,
        affectedScope: input.affectedScope,
        documentRef: input.documentRef ?? null,
        ...attr,
        deviceActions: deviceIds.length
          ? {
              create: deviceIds.map((deviceInstanceId) => ({
                tenantId: ctx.tenantId,
                deviceInstanceId,
                affected: null,
                recordedBy: attr.recordedBy,
                recordedByUserId: attr.recordedByUserId,
              })),
            }
          : undefined,
        affectedModels: affectedModels.length
          ? {
              create: affectedModels.map((m) => ({
                tenantId: ctx.tenantId,
                deviceModelId: m.deviceModelId ?? null,
                basicUdiDi: m.basicUdiDi?.trim() || null,
                serialFrom: m.serialFrom?.trim() || null,
                serialTo: m.serialTo?.trim() || null,
                lotNumber: m.lotNumber?.trim() || null,
                note: m.note?.trim() || null,
              })),
            }
          : undefined,
      },
      include: includeActions,
    });
    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "FieldSafetyAction",
      resourceId: row.id,
      action: "create",
      summary: `FSCA ${row.reference}${affectedModels.length ? ` + ${affectedModels.length} model scopes` : ""}`,
    });
    return mapAction(row, await suggestedCountForAction(ctx.tenantId, row));
  },

  async addAffectedModels(
    ctx: TenantContext,
    actionId: string,
    input: AddFieldSafetyAffectedModelsInput,
  ): Promise<FieldSafetyActionDTO> {
    requirePermission(ctx, "fieldsafety:create");
    const action = await prisma.fieldSafetyAction.findFirst({ where: { id: actionId } });
    if (!action) throw notFound("Field safety action not found");
    const models = normalizeAffectedModels(input.affectedModels);
    if (!models.length) throw badRequest("Provide at least one affected model scope");

    await prisma.fieldSafetyAffectedModel.createMany({
      data: models.map((m) => ({
        tenantId: ctx.tenantId,
        fieldSafetyActionId: actionId,
        deviceModelId: m.deviceModelId ?? null,
        basicUdiDi: m.basicUdiDi?.trim() || null,
        serialFrom: m.serialFrom?.trim() || null,
        serialTo: m.serialTo?.trim() || null,
        lotNumber: m.lotNumber?.trim() || null,
        note: m.note?.trim() || null,
      })),
    });

    const row = await prisma.fieldSafetyAction.findFirstOrThrow({
      where: { id: actionId },
      include: includeActions,
    });
    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "FieldSafetyAffectedModel",
      resourceId: actionId,
      action: "add",
      summary: `Added ${models.length} affected model scope(s)`,
    });
    return mapAction(row, await suggestedCountForAction(ctx.tenantId, row));
  },

  /**
   * Enqueue inventory matches from affectedModels onto Abgleich (affected=null).
   * Does not mark devices as affected.
   */
  async suggestCandidates(ctx: TenantContext, actionId: string): Promise<FieldSafetyActionDTO> {
    requirePermission(ctx, "fieldsafety:create");
    const action = await prisma.fieldSafetyAction.findFirst({
      where: { id: actionId },
      include: includeActions,
    });
    if (!action) throw notFound("Field safety action not found");
    if (action.closedAt) throw badRequest("Action is closed");
    if (action.affectedModels.length === 0) {
      throw badRequest("Add affected model scopes before suggesting candidates");
    }

    const linked = action.deviceActions.map((d) => d.deviceInstanceId);
    const ids = await findMatchingDeviceIds(ctx.tenantId, action.affectedModels, linked);
    const attr = recordedByAttribution(ctx);

    if (ids.length) {
      await prisma.fieldSafetyDeviceAction.createMany({
        data: ids.map((deviceInstanceId) => ({
          tenantId: ctx.tenantId,
          fieldSafetyActionId: actionId,
          deviceInstanceId,
          affected: null,
          recordedBy: attr.recordedBy,
          recordedByUserId: attr.recordedByUserId,
        })),
        skipDuplicates: true,
      });
    }

    const row = await prisma.fieldSafetyAction.findFirstOrThrow({
      where: { id: actionId },
      include: includeActions,
    });
    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "FieldSafetyAction",
      resourceId: actionId,
      action: "suggest",
      summary: `Suggested ${ids.length} candidate(s) for Abgleich`,
      after: { added: ids.length },
    });
    return mapAction(row, 0);
  },

  async matchDevice(
    ctx: TenantContext,
    actionId: string,
    input: MatchFieldSafetyDeviceInput,
  ): Promise<FieldSafetyActionDTO> {
    requirePermission(ctx, "fieldsafety:create");
    const action = await prisma.fieldSafetyAction.findFirst({ where: { id: actionId } });
    if (!action) throw notFound("Field safety action not found");
    const device = await prisma.deviceInstance.findFirst({ where: { id: input.deviceInstanceId } });
    if (!device) throw notFound("Device not found");

    const attr = recordedByAttribution(ctx);
    await prisma.fieldSafetyDeviceAction.upsert({
      where: {
        fieldSafetyActionId_deviceInstanceId: {
          fieldSafetyActionId: actionId,
          deviceInstanceId: input.deviceInstanceId,
        },
      },
      update: {
        affected: input.affected,
        actionTakenAt: input.actionTakenAt ? new Date(`${input.actionTakenAt}T00:00:00.000Z`) : null,
        actionNote: input.actionNote ?? null,
        ...attr,
      },
      create: {
        tenantId: ctx.tenantId,
        fieldSafetyActionId: actionId,
        deviceInstanceId: input.deviceInstanceId,
        affected: input.affected,
        actionTakenAt: input.actionTakenAt ? new Date(`${input.actionTakenAt}T00:00:00.000Z`) : null,
        actionNote: input.actionNote ?? null,
        ...attr,
      },
    });

    const row = await prisma.fieldSafetyAction.findFirstOrThrow({
      where: { id: actionId },
      include: includeActions,
    });
    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "FieldSafetyDeviceAction",
      resourceId: actionId,
      action: "match",
      summary: `Match ${device.inventoryNumber} affected=${String(input.affected)}`,
    });
    return mapAction(row, await suggestedCountForAction(ctx.tenantId, row));
  },

  async close(ctx: TenantContext, id: string): Promise<FieldSafetyActionDTO> {
    requirePermission(ctx, "fieldsafety:create");
    const existing = await prisma.fieldSafetyAction.findFirst({
      where: { id },
      include: includeActions,
    });
    if (!existing) throw notFound("Field safety action not found");
    const unmatched = existing.deviceActions.filter((d) => d.affected === null).length;
    const pendingMeasure = existing.deviceActions.filter(
      (d) => d.affected === true && d.actionTakenAt == null,
    ).length;
    if (unmatched > 0 || pendingMeasure > 0) {
      throw badRequest(
        `Cannot close: ${unmatched} device(s) still to check, ${pendingMeasure} affected without recorded measure`,
      );
    }
    const row = await prisma.fieldSafetyAction.update({
      where: { id },
      data: { closedAt: new Date() },
      include: includeActions,
    });
    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "FieldSafetyAction",
      resourceId: id,
      action: "close",
      summary: `Closed FSCA ${row.reference}`,
    });
    return mapAction(row, 0);
  },
};
