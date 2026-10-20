import type {
  RefReprocessingCheckDTO,
  ReprocessingBatchDTO,
  ReprocessingCheckDTO,
  TenantContext,
} from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { actorFromTenant } from "@/lib/auth/actorContext";
import { recordedByAttribution } from "@/lib/auth/attribution";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import { isBatchUsable } from "@/services/k10/k10HardRules";
import type {
  CreateReprocessingBatchInput,
  CreateReprocessingCheckInput,
  ReleaseBatchInput,
} from "@/schemas/k10";
import { isReprocessingEquipmentDevice } from "@/services/registration/reprocessingLinkService";
import {
  assertDeviceInWorkAreas,
  assertSiteInWorkAreas,
  getEffectiveAreaScope,
  getEffectiveSiteIds,
} from "@/services/users/userAreaScope";
import type { Prisma } from "@prisma/client";

function isoDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function startOfTodayUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

/** Prisma filter: equipment / site / batch linked to caller's work areas. */
async function reprocessingAccessWhere(
  ctx: TenantContext,
): Promise<Prisma.ReprocessingCheckWhereInput | "empty" | null> {
  const scope = await getEffectiveAreaScope(ctx);
  if (scope.mode === "all") return null;
  if (scope.mode === "none") return "empty";
  const siteIds = await getEffectiveSiteIds(ctx);
  const areaFilter = { areaId: { in: scope.areaIds } };
  return {
    OR: [
      { equipmentDevice: areaFilter },
      ...(siteIds && siteIds.length > 0 ? [{ siteId: { in: siteIds } }] : []),
      { batch: { equipmentDevice: areaFilter } },
      // Catalogue-only rows without equipment/site stay hidden for scoped users.
    ],
  };
}

function mapRef(r: {
  code: string;
  scope: string;
  equipmentTypeCode: string | null;
  label: string;
  cadence: string;
  legalBasis: string | null;
  unit: string | null;
  limitText: string | null;
}): RefReprocessingCheckDTO {
  return {
    code: r.code,
    scope: r.scope,
    equipmentTypeCode: r.equipmentTypeCode,
    label: r.label,
    cadence: r.cadence,
    legalBasis: r.legalBasis,
    unit: r.unit,
    limitText: r.limitText,
  };
}

function mapCheck(r: {
  id: string;
  checkCode: string;
  equipmentDeviceId: string | null;
  siteId: string | null;
  batchId: string | null;
  performedAt: Date;
  performedBy: string;
  passed: boolean | null;
  measuredValue: string | null;
  withinLimit: boolean | null;
  note: string | null;
  check: { label: string; scope: string };
  equipmentDevice?: { inventoryNumber: string } | null;
  site?: { name: string } | null;
}): ReprocessingCheckDTO {
  return {
    id: r.id,
    checkCode: r.checkCode,
    checkLabel: r.check.label,
    scope: r.check.scope,
    equipmentDeviceId: r.equipmentDeviceId,
    inventoryNumber: r.equipmentDevice?.inventoryNumber ?? null,
    siteId: r.siteId,
    siteName: r.site?.name ?? null,
    batchId: r.batchId,
    performedAt: isoDate(r.performedAt)!,
    performedBy: r.performedBy,
    passed: r.passed,
    measuredValue: r.measuredValue,
    withinLimit: r.withinLimit,
    note: r.note,
  };
}

function mapBatch(r: {
  id: string;
  equipmentDeviceId: string;
  batchNumber: string;
  programme: string | null;
  loadPattern: string | null;
  processRecordRef: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  releaseResult: ReprocessingBatchDTO["releaseResult"];
  releasedBy: string | null;
  releasedAt: Date | null;
  releaseNote: string | null;
  equipmentDevice: {
    inventoryNumber: string;
    model?: { tradeName: string | null; modelName: string | null } | null;
  };
  items?: Array<{
    label: string | null;
    quantity: number;
    deviceInstance?: { inventoryNumber: string } | null;
  }>;
  _count?: { items: number };
}): ReprocessingBatchDTO {
  const items = (r.items ?? []).map((i) => ({
    label: i.label,
    inventoryNumber: i.deviceInstance?.inventoryNumber ?? null,
    quantity: i.quantity,
  }));
  const model = r.equipmentDevice.model;
  return {
    id: r.id,
    equipmentDeviceId: r.equipmentDeviceId,
    inventoryNumber: r.equipmentDevice.inventoryNumber,
    equipmentLabel: model?.tradeName || model?.modelName || null,
    batchNumber: r.batchNumber,
    programme: r.programme,
    loadPattern: r.loadPattern,
    processRecordRef: r.processRecordRef,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
    releaseResult: r.releaseResult,
    releasedBy: r.releasedBy,
    releasedAt: r.releasedAt?.toISOString() ?? null,
    releaseNote: r.releaseNote,
    itemCount: r._count?.items ?? items.length,
    items,
  };
}

const batchInclude = {
  equipmentDevice: {
    select: {
      inventoryNumber: true,
      model: { select: { tradeName: true, modelName: true } },
    },
  },
  items: {
    select: {
      label: true,
      quantity: true,
      deviceInstance: { select: { inventoryNumber: true } },
    },
  },
  _count: { select: { items: true } },
} as const;

export type ReprocessingCheckListQuery = {
  cadence?: string;
  scope?: string;
  /** Comma-separated or multi scope filter (water,chemistry). */
  scopes?: string[];
  /** When true, return daily catalogue rows still missing evidence for today. */
  openToday?: boolean;
};

function scopeFilter(scope?: string, scopes?: string[]): string[] | undefined {
  if (scopes?.length) return scopes;
  if (scope) return [scope];
  return undefined;
}

export const reprocessingEvidenceService = {
  async listRefChecks(
    ctx: TenantContext,
    query: { cadence?: string; scope?: string; scopes?: string[] } = {},
  ): Promise<RefReprocessingCheckDTO[]> {
    requirePermission(ctx, "reprocessing:view");
    const scopes = scopeFilter(query.scope, query.scopes);
    const rows = await prisma.refReprocessingCheck.findMany({
      where: {
        ...(query.cadence ? { cadence: query.cadence as never } : {}),
        ...(scopes?.length ? { scope: { in: scopes as never[] } } : {}),
      },
      orderBy: { code: "asc" },
    });
    return rows.map(mapRef);
  },

  /**
   * Daily catalogue checks that have no tenant evidence dated today.
   * Used by dashboard `routine-heute` and `/reprocessing?openToday=1`.
   * Permission is not checked here so the dashboard board can reuse it.
   * Area-scoped callers only see refs relevant to their work areas / sites.
   */
  async listOpenDailyChecks(
    ctx: TenantContext,
    scopes?: string[],
  ): Promise<RefReprocessingCheckDTO[]> {
    const areaScope = await getEffectiveAreaScope(ctx);
    if (areaScope.mode === "none") return [];

    const today = startOfTodayUtc();
    const refs = await prisma.refReprocessingCheck.findMany({
      where: {
        cadence: "daily",
        ...(scopes?.length ? { scope: { in: scopes as never[] } } : {}),
      },
      orderBy: { code: "asc" },
    });
    if (refs.length === 0) return [];

    let relevant = refs;
    if (areaScope.mode === "areas") {
      const siteIds = (await getEffectiveSiteIds(ctx)) ?? [];
      const devices = await prisma.deviceInstance.findMany({
        where: {
          tenantId: ctx.tenantId,
          areaId: { in: areaScope.areaIds },
          state: { not: "retired" },
        },
        select: { productKindCode: true, characteristicsJson: true },
        take: 500,
      });
      const hasEquipment = devices.some(isReprocessingEquipmentDevice);
      const hasSites = siteIds.length > 0;
      relevant = refs.filter((r) => {
        if (r.scope === "equipment") return hasEquipment;
        if (r.scope === "water" || r.scope === "chemistry" || r.scope === "sterile_storage") {
          return hasSites;
        }
        return true;
      });
      if (relevant.length === 0) return [];
    }

    const done = await prisma.reprocessingCheck.findMany({
      where: {
        tenantId: ctx.tenantId,
        performedAt: today,
        checkCode: { in: relevant.map((r) => r.code) },
      },
      select: { checkCode: true },
    });
    const doneSet = new Set(done.map((d) => d.checkCode));
    return relevant.filter((r) => !doneSet.has(r.code)).map(mapRef);
  },

  async countOpenDailyChecks(ctx: TenantContext, scopes?: string[]): Promise<number> {
    const open = await this.listOpenDailyChecks(ctx, scopes);
    return open.length;
  },

  async listChecks(
    ctx: TenantContext,
    query: ReprocessingCheckListQuery = {},
  ): Promise<ReprocessingCheckDTO[]> {
    requirePermission(ctx, "reprocessing:view");
    const access = await reprocessingAccessWhere(ctx);
    if (access === "empty") return [];
    const scopes = scopeFilter(query.scope, query.scopes);
    const rows = await prisma.reprocessingCheck.findMany({
      where: {
        ...(access ?? {}),
        ...(query.cadence || scopes?.length
          ? {
              check: {
                ...(query.cadence ? { cadence: query.cadence as never } : {}),
                ...(scopes?.length ? { scope: { in: scopes as never[] } } : {}),
              },
            }
          : {}),
      },
      include: {
        check: true,
        equipmentDevice: { select: { inventoryNumber: true } },
        site: { select: { name: true } },
      },
      orderBy: { performedAt: "desc" },
      take: 300,
    });
    return rows.map(mapCheck);
  },

  async recordCheck(ctx: TenantContext, input: CreateReprocessingCheckInput): Promise<ReprocessingCheckDTO> {
    requirePermission(ctx, "reprocessing:view");
    const ref = await prisma.refReprocessingCheck.findUnique({ where: { code: input.checkCode } });
    if (!ref) throw badRequest("Unknown check code");

    if (ref.cadence === "per_batch" && !input.batchId) {
      throw badRequest("per_batch checks require batchId");
    }
    if (ref.scope === "equipment" && !input.equipmentDeviceId) {
      throw badRequest("equipment checks require equipmentDeviceId");
    }
    if ((ref.scope === "water" || ref.scope === "chemistry" || ref.scope === "sterile_storage") && !input.siteId) {
      throw badRequest("Site-scoped checks require siteId");
    }

    if (input.equipmentDeviceId) {
      const equipment = await prisma.deviceInstance.findFirst({
        where: { id: input.equipmentDeviceId },
        select: { areaId: true },
      });
      if (!equipment) throw notFound("Equipment device not found");
      await assertDeviceInWorkAreas(ctx, equipment.areaId);
    }
    if (input.siteId) {
      await assertSiteInWorkAreas(ctx, input.siteId);
    }
    if (input.batchId) {
      const batch = await prisma.reprocessingBatch.findFirst({
        where: { id: input.batchId },
        select: { equipmentDevice: { select: { areaId: true } } },
      });
      if (!batch) throw notFound("Batch not found");
      await assertDeviceInWorkAreas(ctx, batch.equipmentDevice.areaId);
    }

    const row = await prisma.reprocessingCheck.create({
      data: {
        tenantId: ctx.tenantId,
        checkCode: input.checkCode,
        equipmentDeviceId: input.equipmentDeviceId ?? null,
        siteId: input.siteId ?? null,
        batchId: input.batchId ?? null,
        performedAt: new Date(`${input.performedAt}T00:00:00.000Z`),
        performedBy: ctx.user.name,
        performedById: ctx.user.id,
        passed: input.passed ?? null,
        measuredValue: input.measuredValue ?? null,
        withinLimit: input.withinLimit ?? null,
        note: input.note ?? null,
      },
      include: {
        check: true,
        equipmentDevice: { select: { inventoryNumber: true } },
        site: { select: { name: true } },
      },
    });

    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "ReprocessingCheck",
      resourceId: row.id,
      action: "create",
      summary: `Check ${row.checkCode}`,
    });

    return mapCheck(row);
  },

  async listBatches(ctx: TenantContext): Promise<ReprocessingBatchDTO[]> {
    requirePermission(ctx, "reprocessing:view");
    const scope = await getEffectiveAreaScope(ctx);
    if (scope.mode === "none") return [];
    const rows = await prisma.reprocessingBatch.findMany({
      where:
        scope.mode === "areas"
          ? { equipmentDevice: { areaId: { in: scope.areaIds } } }
          : undefined,
      include: batchInclude,
      orderBy: { startedAt: "desc" },
      take: 200,
    });
    return rows.map(mapBatch);
  },

  async createBatch(ctx: TenantContext, input: CreateReprocessingBatchInput): Promise<ReprocessingBatchDTO> {
    requirePermission(ctx, "reprocessing:view");
    const device = await prisma.deviceInstance.findFirst({
      where: { id: input.equipmentDeviceId },
      select: { id: true, areaId: true },
    });
    if (!device) throw notFound("Equipment device not found");
    await assertDeviceInWorkAreas(ctx, device.areaId);

    for (const item of input.items) {
      if (!item.deviceInstanceId) continue;
      const itemDevice = await prisma.deviceInstance.findFirst({
        where: { id: item.deviceInstanceId },
        select: { areaId: true },
      });
      if (!itemDevice) throw badRequest("Unknown batch item device");
      await assertDeviceInWorkAreas(ctx, itemDevice.areaId);
    }

    const row = await prisma.reprocessingBatch.create({
      data: {
        tenantId: ctx.tenantId,
        equipmentDeviceId: input.equipmentDeviceId,
        batchNumber: input.batchNumber,
        programme: input.programme ?? null,
        startedAt: new Date(input.startedAt),
        finishedAt: input.finishedAt ? new Date(input.finishedAt) : null,
        loadPattern: input.loadPattern ?? null,
        processRecordRef: input.processRecordRef ?? null,
        ...recordedByAttribution(ctx),
        items: {
          create: input.items.map((item) => ({
            tenantId: ctx.tenantId,
            deviceInstanceId: item.deviceInstanceId ?? null,
            label: item.label ?? null,
            quantity: item.quantity ?? 1,
          })),
        },
      },
      include: batchInclude,
    });

    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "ReprocessingBatch",
      resourceId: row.id,
      action: "create",
      summary: `Batch ${row.batchNumber} (unreleased)`,
    });

    return mapBatch(row);
  },

  async release(ctx: TenantContext, id: string, input: ReleaseBatchInput): Promise<ReprocessingBatchDTO> {
    requirePermission(ctx, "reprocessing:release");
    const existing = await prisma.reprocessingBatch.findFirst({
      where: { id },
      include: { equipmentDevice: { select: { areaId: true } } },
    });
    if (!existing) throw notFound("Batch not found");
    if (existing.releaseResult) throw badRequest("Batch already released or rejected");
    await assertDeviceInWorkAreas(ctx, existing.equipmentDevice.areaId);

    const row = await prisma.reprocessingBatch.update({
      where: { id },
      data: {
        releaseResult: input.releaseResult,
        releaseNote: input.releaseNote ?? null,
        releasedBy: ctx.user.name,
        releasedById: ctx.user.id,
        releasedAt: new Date(),
        finishedAt: existing.finishedAt ?? new Date(),
      },
      include: batchInclude,
    });

    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "ReprocessingBatch",
      resourceId: id,
      action: "release",
      summary: `Batch ${row.batchNumber} → ${row.releaseResult}`,
    });

    return mapBatch(row);
  },

  /** Hard gate: unreleased batches must not be treated as usable. */
  async assertBatchUsable(ctx: TenantContext, batchId: string): Promise<void> {
    requirePermission(ctx, "reprocessing:view");
    const batch = await prisma.reprocessingBatch.findFirst({ where: { id: batchId } });
    if (!batch) throw notFound("Batch not found");
    if (!isBatchUsable(batch.releaseResult)) {
      throw forbidden("Unreleased batch must not be used");
    }
  },
};
