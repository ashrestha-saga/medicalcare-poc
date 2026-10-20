import type { ScanHeuteBand, ScanHeuteDTO, ScanHeuteItemDTO, TenantContext } from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { prisma } from "@/lib/prisma";
import { isReprocessingEquipmentDevice } from "@/services/registration/reprocessingLinkService";
import { getEffectiveAreaScope } from "@/services/users/userAreaScope";
import { openDailyRefCodesForDevice } from "./scanRoutineService";
import { consequenceMeansOutOfService } from "./scanPrimaryAction";

const BAND_ORDER: Record<ScanHeuteBand, number> = {
  blocked: 0,
  open: 1,
  notice: 2,
  done: 3,
};

function startOfTodayUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

/**
 * Area-scoped “Heute” worklist for Scan v3.
 *
 * With `reprocessing:view`: only Aufbereitungsgeräte that still need today's
 * work — open daily catalogue steps (RefReprocessingCheck vs today's evidence)
 * and/or unreleased batches / Sperrlage.
 *
 * Without reprocessing: devices with open Konstanz or Sperrlage (blocked).
 */
export const scanHeuteService = {
  async list(ctx: TenantContext): Promise<ScanHeuteDTO> {
    requirePermission(ctx, "inventory:view");

    const scope = await getEffectiveAreaScope(ctx);
    if (scope.mode === "none") {
      return { items: [], areaIds: [], unscoped: false };
    }

    const canReproc = Boolean(ctx.permissions?.includes("reprocessing:view"));
    const today = startOfTodayUtc();

    const devices = await prisma.deviceInstance.findMany({
      where: {
        tenantId: ctx.tenantId,
        state: { not: "retired" },
        ...(scope.mode === "areas" ? { areaId: { in: scope.areaIds } } : {}),
      },
      select: {
        id: true,
        inventoryNumber: true,
        state: true,
        productKindCode: true,
        characteristicsJson: true,
        room: true,
        model: { select: { tradeName: true, modelName: true, manufacturer: true } },
        area: {
          select: {
            name: true,
            siteId: true,
            site: { select: { name: true } },
          },
        },
      },
      take: 500,
      orderBy: { inventoryNumber: "asc" },
    });

    const deviceIds = devices.map((d) => d.id);

    const [openBatches, dailyRefs, doneToday, openKonstanzDuties, bookStops] = await Promise.all([
      deviceIds.length === 0
        ? Promise.resolve([] as { equipmentDeviceId: string }[])
        : prisma.reprocessingBatch.findMany({
            where: { releaseResult: null, equipmentDeviceId: { in: deviceIds } },
            select: { equipmentDeviceId: true },
          }),
      canReproc
        ? prisma.refReprocessingCheck.findMany({
            where: { cadence: "daily" },
            select: { code: true, scope: true, equipmentTypeCode: true },
          })
        : Promise.resolve([]),
      canReproc && deviceIds.length > 0
        ? (() => {
            const siteIds = [
              ...new Set(
                devices.map((d) => d.area?.siteId).filter((id): id is string => Boolean(id)),
              ),
            ];
            return prisma.reprocessingCheck.findMany({
              where: {
                performedAt: today,
                OR: [
                  { equipmentDeviceId: { in: deviceIds } },
                  ...(siteIds.length ? [{ siteId: { in: siteIds } }] : []),
                ],
              },
              select: { checkCode: true, equipmentDeviceId: true, siteId: true },
            });
          })()
        : Promise.resolve([]),
      !canReproc && deviceIds.length > 0
        ? prisma.deviceDuty.findMany({
            where: {
              deviceInstanceId: { in: deviceIds },
              dutyKey: "konstanz",
              applicable: true,
              suspendedAt: null,
              dueAt: { lte: today },
            },
            select: { deviceInstanceId: true },
          })
        : Promise.resolve([]),
      deviceIds.length === 0
        ? Promise.resolve([] as { deviceInstanceId: string; consequence: string | null }[])
        : prisma.deviceBookEntry.findMany({
            where: { deviceInstanceId: { in: deviceIds } },
            orderBy: [{ occurredAt: "desc" }, { recordedAt: "desc" }],
            select: { deviceInstanceId: true, consequence: true },
            take: 2000,
          }),
    ]);

    const openBatchByDevice = new Map<string, number>();
    for (const b of openBatches) {
      openBatchByDevice.set(b.equipmentDeviceId, (openBatchByDevice.get(b.equipmentDeviceId) ?? 0) + 1);
    }
    const openKonstanzSet = new Set(openKonstanzDuties.map((d) => d.deviceInstanceId));
    const blockedByBook = new Set<string>();
    for (const b of bookStops) {
      if (blockedByBook.has(b.deviceInstanceId)) continue;
      if (consequenceMeansOutOfService(b.consequence)) {
        blockedByBook.add(b.deviceInstanceId);
      }
    }

    const items: ScanHeuteItemDTO[] = [];

    for (const d of devices) {
      const isEquipment = isReprocessingEquipmentDevice(d);
      const openBatchCount = openBatchByDevice.get(d.id) ?? 0;
      const openDailyCodes = canReproc
        ? openDailyRefCodesForDevice(
            {
              id: d.id,
              productKindCode: d.productKindCode,
              characteristicsJson: d.characteristicsJson,
              siteId: d.area?.siteId ?? null,
            },
            dailyRefs,
            doneToday,
          )
        : [];
      const openDailyChecks = openDailyCodes.length > 0;
      const openKonstanzChecks = openKonstanzSet.has(d.id);
      const bookBlocked = blockedByBook.has(d.id);
      const hasOpenReprocWork = openDailyChecks || openBatchCount > 0 || bookBlocked;

      // Reprocessing persona: equipment in scope — open work first, cleared stays as done.
      if (canReproc) {
        if (!isEquipment) continue;
      } else {
        // Other capturers: Konstanz due or Außer Betrieb.
        if (!openKonstanzChecks && !bookBlocked) continue;
      }

      let band: ScanHeuteBand = "open";
      if (bookBlocked || d.state !== "released") band = "blocked";
      else if (canReproc && !hasOpenReprocWork) band = "done";
      else if (openKonstanzChecks && !openDailyChecks && openBatchCount === 0) band = "notice";

      const label =
        d.model?.tradeName?.trim() ||
        d.model?.modelName?.trim() ||
        d.model?.manufacturer?.trim() ||
        d.inventoryNumber;

      items.push({
        deviceId: d.id,
        inventoryNumber: d.inventoryNumber,
        label,
        areaName: d.area?.name ?? null,
        siteName: d.area?.site?.name ?? null,
        room: d.room,
        state: d.state as ScanHeuteItemDTO["state"],
        band,
        openBatchCount,
        openDailyChecks,
        openKonstanzChecks,
      });
    }

    items.sort((a, b) => {
      const bandDiff = BAND_ORDER[a.band] - BAND_ORDER[b.band];
      if (bandDiff !== 0) return bandDiff;
      return a.inventoryNumber.localeCompare(b.inventoryNumber);
    });

    return {
      items,
      areaIds: scope.mode === "areas" ? scope.areaIds : null,
      unscoped: scope.mode === "all",
    };
  },
};
