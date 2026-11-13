import type {
  RefReprocessingCheckDTO,
  ReprocessingBatchDTO,
  ReprocessingCheckDTO,
  ReprocessingExecutionDoneDTO,
  ReprocessingExecutionItemDTO,
  ReprocessingExecutionResponse,
  ReprocessingExecutionStatus,
  TenantWorkContext,
} from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { actorFromContext } from "@/lib/auth/actorContext";
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
  openDailyRefCodesForDevice,
} from "@/services/scan/scanRoutineService";
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
  ctx: TenantWorkContext,
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
    ctx: TenantWorkContext,
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
    ctx: TenantWorkContext,
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

  async countOpenDailyChecks(ctx: TenantWorkContext, scopes?: string[]): Promise<number> {
    const open = await this.listOpenDailyChecks(ctx, scopes);
    return open.length;
  },

  /**
   * Execution lens — daily status per reprocessing device (equipment scope)
   * or per site (water / chemistry / sterile_storage).
   */
  async listExecution(
    ctx: TenantWorkContext,
    query: { scopes?: string[]; day?: string } = {},
  ): Promise<ReprocessingExecutionResponse> {
    requirePermission(ctx, "reprocessing:view");
    const areaScope = await getEffectiveAreaScope(ctx);
    if (areaScope.mode === "none") {
      const day = query.day?.slice(0, 10) || isoDate(startOfTodayUtc())!;
      return { day, kind: "device", items: [] };
    }

    const dayStr = query.day?.slice(0, 10) || isoDate(startOfTodayUtc())!;
    const day = new Date(`${dayStr}T00:00:00.000Z`);
    const scopes = query.scopes?.length ? query.scopes : ["equipment"];
    const siteScoped = scopes.some((s) =>
      s === "water" || s === "chemistry" || s === "sterile_storage",
    );
    const equipmentScoped = scopes.includes("equipment");

    const dailyRefs = await prisma.refReprocessingCheck.findMany({
      where: {
        cadence: "daily",
        ...(scopes.length ? { scope: { in: scopes as never[] } } : {}),
      },
      orderBy: { code: "asc" },
    });
    const refByCode = new Map(dailyRefs.map((r) => [r.code, r]));

    if (siteScoped && !equipmentScoped) {
      // null = unscoped (all sites); [] = no access.
      const effectiveSiteIds = await getEffectiveSiteIds(ctx);
      if (effectiveSiteIds !== null && effectiveSiteIds.length === 0) {
        return { day: dayStr, kind: "site", items: [] };
      }
      const sites = await prisma.site.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(effectiveSiteIds ? { id: { in: effectiveSiteIds } } : {}),
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      const siteIds = sites.map((s) => s.id);
      if (siteIds.length === 0) {
        return { day: dayStr, kind: "site", items: [] };
      }
      const siteRefs = dailyRefs.filter(
        (r) => r.scope === "water" || r.scope === "chemistry" || r.scope === "sterile_storage",
      );
      const doneRows =
        siteRefs.length === 0
          ? []
          : await prisma.reprocessingCheck.findMany({
              where: {
                tenantId: ctx.tenantId,
                performedAt: day,
                siteId: { in: siteIds },
                checkCode: { in: siteRefs.map((r) => r.code) },
              },
              include: { check: true },
              orderBy: { recordedAt: "asc" },
            });

      const items: ReprocessingExecutionItemDTO[] = sites.map((site) => {
        const applicable = siteRefs;
        const applicableCodes = new Set(applicable.map((r) => r.code));
        const siteDone = doneRows.filter(
          (r) => r.siteId === site.id && applicableCodes.has(r.checkCode),
        );
        const seen = new Set<string>();
        const doneToday: ReprocessingExecutionDoneDTO[] = [];
        for (const row of siteDone) {
          if (seen.has(row.checkCode)) continue;
          seen.add(row.checkCode);
          const ref = refByCode.get(row.checkCode);
          if (!ref) continue;
          doneToday.push({
            checkCode: row.checkCode,
            label: ref.label,
            scope: ref.scope,
            passed: row.passed,
            measuredValue: row.measuredValue,
            unit: ref.unit,
            limitText: ref.limitText,
            withinLimit: row.withinLimit,
            performedBy: row.performedBy,
            performedAt: isoDate(row.performedAt)!,
            note: row.note,
          });
        }
        const doneCodes = new Set(doneToday.map((d) => d.checkCode));
        const openRefs = applicable.filter((r) => !doneCodes.has(r.code));
        const applicableCount = applicable.length;
        const doneCount = doneToday.length;
        const openCount = openRefs.length;
        const status: ReprocessingExecutionStatus =
          applicableCount === 0
            ? "done"
            : openCount === 0
              ? "done"
              : doneCount === 0
                ? "open"
                : "partial";
        const last = doneToday[doneToday.length - 1];
        return {
          id: site.id,
          kind: "site" as const,
          label: site.name,
          subtitle: null,
          inventoryNumber: null,
          siteId: site.id,
          siteName: site.name,
          equipmentDeviceId: null,
          status,
          applicableCount,
          doneCount,
          openCount,
          openCheckCodes: openRefs.map((r) => r.code),
          openCheckLabels: openRefs.map((r) => r.label),
          lastPerformedAt: last?.performedAt ?? null,
          lastPerformedBy: last?.performedBy ?? null,
          doneToday,
        };
      });

      items.sort((a, b) => {
        const rank = { open: 0, partial: 1, done: 2 };
        return rank[a.status] - rank[b.status] || a.label.localeCompare(b.label);
      });
      return { day: dayStr, kind: "site", items };
    }

    // Device execution (equipment tab / mixed with equipment in scopes)
    const deviceWhere: Prisma.DeviceInstanceWhereInput = {
      tenantId: ctx.tenantId,
      state: { not: "retired" },
      ...(areaScope.mode === "areas" ? { areaId: { in: areaScope.areaIds } } : {}),
    };
    const devices = await prisma.deviceInstance.findMany({
      where: deviceWhere,
      select: {
        id: true,
        inventoryNumber: true,
        productKindCode: true,
        characteristicsJson: true,
        model: { select: { tradeName: true, modelName: true } },
        area: { select: { name: true, siteId: true, site: { select: { name: true } } } },
      },
      orderBy: { inventoryNumber: "asc" },
      take: 500,
    });
    const equipment = devices.filter(isReprocessingEquipmentDevice);

    const equipmentRefs = dailyRefs.filter((r) => r.scope === "equipment");
    // For pure equipment tab, only equipment-scoped daily checks apply in the matrix.
    const refsForApplicability = equipmentScoped && !siteScoped
      ? equipmentRefs
      : dailyRefs;

    const deviceIds = equipment.map((d) => d.id);
    const siteIdsFromDevices = [
      ...new Set(equipment.map((d) => d.area?.siteId).filter(Boolean) as string[]),
    ];
    const doneRows =
      refsForApplicability.length === 0 || deviceIds.length === 0
        ? []
        : await prisma.reprocessingCheck.findMany({
            where: {
              tenantId: ctx.tenantId,
              performedAt: day,
              checkCode: { in: refsForApplicability.map((r) => r.code) },
              OR: [
                { equipmentDeviceId: { in: deviceIds } },
                ...(siteIdsFromDevices.length
                  ? [{ siteId: { in: siteIdsFromDevices } }]
                  : []),
              ],
            },
            include: { check: true },
            orderBy: { recordedAt: "asc" },
          });

    const items: ReprocessingExecutionItemDTO[] = equipment.map((device) => {
      const siteId = device.area?.siteId ?? null;
      const deviceCtx = {
        id: device.id,
        productKindCode: device.productKindCode,
        characteristicsJson: device.characteristicsJson,
        siteId,
      };
      // When only equipment scope is requested, pretend site refs don't apply.
      const refsInput = refsForApplicability.map((r) => ({
        code: r.code,
        scope: r.scope,
        equipmentTypeCode: r.equipmentTypeCode,
      }));
      const applicableCodes = openDailyRefCodesForDevice(deviceCtx, refsInput, []);
      const openCodes = openDailyRefCodesForDevice(
        deviceCtx,
        refsInput,
        doneRows.map((r) => ({
          checkCode: r.checkCode,
          equipmentDeviceId: r.equipmentDeviceId,
          siteId: r.siteId,
        })),
      );
      const applicableSet = new Set(applicableCodes);
      const openSet = new Set(openCodes);

      const doneToday: ReprocessingExecutionDoneDTO[] = [];
      const seen = new Set<string>();
      for (const row of doneRows) {
        if (!applicableSet.has(row.checkCode) || seen.has(row.checkCode)) continue;
        const ref = refByCode.get(row.checkCode);
        if (!ref) continue;
        if (ref.scope === "equipment" && row.equipmentDeviceId !== device.id) continue;
        if (
          (ref.scope === "water" ||
            ref.scope === "chemistry" ||
            ref.scope === "sterile_storage") &&
          !(siteId && row.siteId === siteId)
        ) {
          continue;
        }
        if (openSet.has(row.checkCode)) continue;
        seen.add(row.checkCode);
        doneToday.push({
          checkCode: row.checkCode,
          label: ref.label,
          scope: ref.scope,
          passed: row.passed,
          measuredValue: row.measuredValue,
          unit: ref.unit,
          limitText: ref.limitText,
          withinLimit: row.withinLimit,
          performedBy: row.performedBy,
          performedAt: isoDate(row.performedAt)!,
          note: row.note,
        });
      }

      const applicableCount = applicableCodes.length;
      const openCount = openCodes.length;
      const doneCount = Math.max(0, applicableCount - openCount);
      const status: ReprocessingExecutionStatus =
        applicableCount === 0
          ? "done"
          : openCount === 0
            ? "done"
            : doneCount === 0
              ? "open"
              : "partial";
      const last = doneToday[doneToday.length - 1];
      const openLabels = openCodes
        .map((code) => refByCode.get(code)?.label ?? code)
        .filter(Boolean);

      return {
        id: device.id,
        kind: "device" as const,
        label: device.inventoryNumber,
        subtitle:
          device.model?.tradeName ||
          device.model?.modelName ||
          device.area?.name ||
          null,
        inventoryNumber: device.inventoryNumber,
        siteId,
        siteName: device.area?.site?.name ?? null,
        equipmentDeviceId: device.id,
        status,
        applicableCount,
        doneCount,
        openCount,
        openCheckCodes: openCodes,
        openCheckLabels: openLabels,
        lastPerformedAt: last?.performedAt ?? null,
        lastPerformedBy: last?.performedBy ?? null,
        doneToday,
      };
    });

    items.sort((a, b) => {
      const rank = { open: 0, partial: 1, done: 2 };
      return rank[a.status] - rank[b.status] || a.label.localeCompare(b.label);
    });

    return { day: dayStr, kind: "device", items };
  },

  async listChecks(
    ctx: TenantWorkContext,
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

  async recordCheck(ctx: TenantWorkContext, input: CreateReprocessingCheckInput): Promise<ReprocessingCheckDTO> {
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
      actor: actorFromContext(ctx),
      resource: "ReprocessingCheck",
      resourceId: row.id,
      action: "create",
      summary: `Check ${row.checkCode}`,
    });

    return mapCheck(row);
  },

  async listBatches(ctx: TenantWorkContext): Promise<ReprocessingBatchDTO[]> {
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

  async createBatch(ctx: TenantWorkContext, input: CreateReprocessingBatchInput): Promise<ReprocessingBatchDTO> {
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
      actor: actorFromContext(ctx),
      resource: "ReprocessingBatch",
      resourceId: row.id,
      action: "create",
      summary: `Batch ${row.batchNumber} (unreleased)`,
    });

    return mapBatch(row);
  },

  async release(ctx: TenantWorkContext, id: string, input: ReleaseBatchInput): Promise<ReprocessingBatchDTO> {
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
      actor: actorFromContext(ctx),
      resource: "ReprocessingBatch",
      resourceId: id,
      action: "release",
      summary: `Batch ${row.batchNumber} → ${row.releaseResult}`,
    });

    return mapBatch(row);
  },

  /** Hard gate: unreleased batches must not be treated as usable. */
  async assertBatchUsable(ctx: TenantWorkContext, batchId: string): Promise<void> {
    requirePermission(ctx, "reprocessing:view");
    const batch = await prisma.reprocessingBatch.findFirst({ where: { id: batchId } });
    if (!batch) throw notFound("Batch not found");
    if (!isBatchUsable(batch.releaseResult)) {
      throw forbidden("Unreleased batch must not be used");
    }
  },
};
