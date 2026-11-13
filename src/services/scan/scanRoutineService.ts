import type {
  ScanRoutineCompletedItemDTO,
  ScanRoutineOpenDTO,
  ScanRoutineResultDTO,
  ScanRoutineStepDTO,
  TenantWorkContext,
} from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { actorFromContext } from "@/lib/auth/actorContext";
import { badRequest, notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import { isReprocessingEquipmentDevice } from "@/services/registration/reprocessingLinkService";
import type { SubmitScanRoutineInput } from "@/schemas/k10";
import {
  assertDeviceInWorkAreas,
  assertSiteInWorkAreas,
} from "@/services/users/userAreaScope";
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfTodayUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

export function equipmentTypeFromDevice(device: {
  productKindCode: string | null;
  characteristicsJson: string | null;
}): string | null {
  if (!device.characteristicsJson) return null;
  try {
    const c = JSON.parse(device.characteristicsJson) as { eigenTyp?: string | null };
    const t = c.eigenTyp?.trim();
    return t || null;
  } catch {
    return null;
  }
}

type DailyRef = {
  code: string;
  scope: string;
  equipmentTypeCode: string | null;
};

/** Which daily packs apply when resolving open checks. */
export type DailyPack = "equipment" | "site";

function isSiteScope(scope: string): boolean {
  return scope === "water" || scope === "chemistry" || scope === "sterile_storage";
}

/**
 * Catalogue comparison for one device: daily RefReprocessingCheck rows still
 * without today's ReprocessingCheck evidence.
 * Default pack filter is equipment-only so site (Haus) checks are not mixed
 * into inventory Tageskontrolle — use openDailyRefCodesForSite for those.
 */
export function openDailyRefCodesForDevice(
  device: {
    id: string;
    productKindCode: string | null;
    characteristicsJson: string | null;
    siteId: string | null;
  },
  dailyRefs: DailyRef[],
  doneToday: Array<{ checkCode: string; equipmentDeviceId: string | null; siteId: string | null }>,
  packs: DailyPack[] = ["equipment"],
): string[] {
  const isEquipment = isReprocessingEquipmentDevice(device);
  const typeCode = equipmentTypeFromDevice(device);
  const siteId = device.siteId;
  const wantEquipment = packs.includes("equipment");
  const wantSite = packs.includes("site");

  const applicable = dailyRefs.filter((r) => {
    if (r.scope === "equipment") {
      if (!wantEquipment || !isEquipment) return false;
      if (typeCode) return r.equipmentTypeCode === typeCode;
      // Equipment without eigenTyp: only untyped equipment catalogue rows.
      return r.equipmentTypeCode == null;
    }
    if (isSiteScope(r.scope)) {
      return wantSite && isEquipment && Boolean(siteId);
    }
    return false;
  });

  const done = new Set(
    doneToday
      .filter((c) => {
        const ref = applicable.find((r) => r.code === c.checkCode);
        if (!ref) return false;
        if (ref.scope === "equipment") return c.equipmentDeviceId === device.id;
        return Boolean(siteId && c.siteId === siteId);
      })
      .map((c) => c.checkCode),
  );

  return applicable.filter((r) => !done.has(r.code)).map((r) => r.code);
}

/** Site-scoped daily checks still open for a site (independent of any INV). */
export function openDailyRefCodesForSite(
  siteId: string,
  dailyRefs: DailyRef[],
  doneToday: Array<{ checkCode: string; siteId: string | null }>,
): string[] {
  const applicable = dailyRefs.filter((r) => isSiteScope(r.scope));
  const done = new Set(
    doneToday.filter((c) => c.siteId === siteId).map((c) => c.checkCode),
  );
  return applicable.filter((r) => !done.has(r.code)).map((r) => r.code);
}

/** Parse limitText like "≤ 30" / "≥ 2,0" against a measured value. */
export function evaluateWithinLimit(
  limitText: string | null | undefined,
  measuredValue: string | null | undefined,
): boolean | null {
  if (!limitText || measuredValue == null || measuredValue.trim() === "") return null;
  const v = parseFloat(measuredValue.replace(",", "."));
  if (Number.isNaN(v)) return null;
  const le = limitText.match(/[≤<=]\s*([\d.,]+)/);
  if (le?.[1]) return v <= parseFloat(le[1].replace(",", "."));
  const ge = limitText.match(/[≥>=]\s*([\d.,]+)/);
  if (ge?.[1]) return v >= parseFloat(ge[1].replace(",", "."));
  return null;
}

export const scanRoutineService = {
  async listOpen(ctx: TenantWorkContext, deviceId: string): Promise<ScanRoutineOpenDTO> {
    requirePermission(ctx, "reprocessing:view");
    const device = await prisma.deviceInstance.findFirst({
      where: { id: deviceId },
      select: {
        id: true,
        inventoryNumber: true,
        areaId: true,
        productKindCode: true,
        characteristicsJson: true,
        model: { select: { tradeName: true, modelName: true } },
        area: { select: { name: true, siteId: true, site: { select: { name: true } } } },
      },
    });
    if (!device) throw notFound("Device not found");
    await assertDeviceInWorkAreas(ctx, device.areaId);

    const today = startOfTodayUtc();
    const isEquipment = isReprocessingEquipmentDevice(device);
    const siteId = device.area?.siteId ?? null;

    const dailyRefs = await prisma.refReprocessingCheck.findMany({
      where: { cadence: "daily" },
      orderBy: { code: "asc" },
    });
    const doneTodayRows =
      dailyRefs.length === 0
        ? []
        : await prisma.reprocessingCheck.findMany({
            where: {
              performedAt: today,
              OR: [
                { equipmentDeviceId: deviceId },
                ...(siteId ? [{ siteId }] : []),
              ],
            },
            select: {
              checkCode: true,
              equipmentDeviceId: true,
              siteId: true,
              passed: true,
              measuredValue: true,
              withinLimit: true,
              note: true,
              performedBy: true,
              recordedAt: true,
            },
            orderBy: { recordedAt: "asc" },
          });

    const deviceCtx = {
      id: device.id,
      productKindCode: device.productKindCode,
      characteristicsJson: device.characteristicsJson,
      siteId,
    };
    // Device Tageskontrolle = equipment pack only (site/Haus is a separate Heute tab).
    const openCodes = new Set(
      openDailyRefCodesForDevice(deviceCtx, dailyRefs, doneTodayRows, ["equipment"]),
    );
    const applicableCodes = new Set(
      openDailyRefCodesForDevice(deviceCtx, dailyRefs, [], ["equipment"]),
    );

    const steps: ScanRoutineStepDTO[] = dailyRefs
      .filter((r) => openCodes.has(r.code))
      .map((r) => ({
        checkCode: r.code,
        label: r.label,
        scope: r.scope,
        unit: r.unit,
        limitText: r.limitText,
        kind: r.unit ? "measure" : "pass_fail",
      }));

    const refByCode = new Map(dailyRefs.map((r) => [r.code, r]));
    const completedToday: ScanRoutineCompletedItemDTO[] = [];
    const seen = new Set<string>();
    for (const row of doneTodayRows) {
      if (!applicableCodes.has(row.checkCode) || seen.has(row.checkCode)) continue;
      const ref = refByCode.get(row.checkCode);
      if (!ref || ref.scope !== "equipment") continue;
      if (row.equipmentDeviceId !== device.id) continue;
      seen.add(row.checkCode);
      completedToday.push({
        checkCode: row.checkCode,
        label: ref.label,
        scope: ref.scope,
        kind: ref.unit ? "measure" : "pass_fail",
        unit: ref.unit,
        limitText: ref.limitText,
        passed: row.passed,
        measuredValue: row.measuredValue,
        withinLimit: row.withinLimit,
        note: row.note,
        performedBy: row.performedBy,
        recordedAt: row.recordedAt.toISOString(),
      });
    }

    const label =
      device.model?.tradeName?.trim() ||
      device.model?.modelName?.trim() ||
      device.inventoryNumber;

    return {
      subjectKind: "device",
      deviceId: device.id,
      inventoryNumber: device.inventoryNumber,
      label,
      siteId,
      siteName: device.area?.site?.name ?? null,
      areaName: device.area?.name ?? null,
      isEquipment,
      steps,
      completedToday,
      performedAt: isoDate(today),
    };
  },

  /** Site / Haus Tageskontrolle — water, chemistry, sterile (no INV). */
  async listOpenForSite(ctx: TenantWorkContext, siteId: string): Promise<ScanRoutineOpenDTO> {
    requirePermission(ctx, "reprocessing:view");
    await assertSiteInWorkAreas(ctx, siteId);
    const site = await prisma.site.findFirst({
      where: { id: siteId, tenantId: ctx.tenantId },
      select: { id: true, name: true },
    });
    if (!site) throw notFound("Site not found");

    const today = startOfTodayUtc();
    const dailyRefs = await prisma.refReprocessingCheck.findMany({
      where: { cadence: "daily" },
      orderBy: { code: "asc" },
    });
    const siteRefs = dailyRefs.filter((r) => isSiteScope(r.scope));
    const doneTodayRows =
      siteRefs.length === 0
        ? []
        : await prisma.reprocessingCheck.findMany({
            where: {
              performedAt: today,
              siteId,
              checkCode: { in: siteRefs.map((r) => r.code) },
            },
            select: {
              checkCode: true,
              equipmentDeviceId: true,
              siteId: true,
              passed: true,
              measuredValue: true,
              withinLimit: true,
              note: true,
              performedBy: true,
              recordedAt: true,
            },
            orderBy: { recordedAt: "asc" },
          });

    const openCodes = new Set(openDailyRefCodesForSite(siteId, siteRefs, doneTodayRows));
    const applicableCodes = new Set(siteRefs.map((r) => r.code));
    const refByCode = new Map(siteRefs.map((r) => [r.code, r]));

    const steps: ScanRoutineStepDTO[] = siteRefs
      .filter((r) => openCodes.has(r.code))
      .map((r) => ({
        checkCode: r.code,
        label: r.label,
        scope: r.scope,
        unit: r.unit,
        limitText: r.limitText,
        kind: r.unit ? "measure" : "pass_fail",
      }));

    const completedToday: ScanRoutineCompletedItemDTO[] = [];
    const seen = new Set<string>();
    for (const row of doneTodayRows) {
      if (!applicableCodes.has(row.checkCode) || seen.has(row.checkCode)) continue;
      const ref = refByCode.get(row.checkCode);
      if (!ref) continue;
      seen.add(row.checkCode);
      completedToday.push({
        checkCode: row.checkCode,
        label: ref.label,
        scope: ref.scope,
        kind: ref.unit ? "measure" : "pass_fail",
        unit: ref.unit,
        limitText: ref.limitText,
        passed: row.passed,
        measuredValue: row.measuredValue,
        withinLimit: row.withinLimit,
        note: row.note,
        performedBy: row.performedBy,
        recordedAt: row.recordedAt.toISOString(),
      });
    }

    return {
      subjectKind: "site",
      deviceId: "",
      inventoryNumber: site.name,
      label: site.name,
      siteId: site.id,
      siteName: site.name,
      areaName: null,
      isEquipment: false,
      steps,
      completedToday,
      performedAt: isoDate(today),
    };
  },

  async submit(
    ctx: TenantWorkContext,
    deviceId: string,
    input: SubmitScanRoutineInput,
  ): Promise<ScanRoutineResultDTO> {
    requirePermission(ctx, "reprocessing:view");
    const open = await this.listOpen(ctx, deviceId);
    if (open.steps.length === 0) {
      throw badRequest("No open daily checks for this device");
    }

    const byCode = new Map(input.answers.map((a) => [a.checkCode, a]));
    for (const step of open.steps) {
      const a = byCode.get(step.checkCode);
      if (!a) {
        throw unprocessable(`Missing answer for ${step.checkCode}`, { field: step.checkCode });
      }
      if (step.kind === "pass_fail") {
        if (a.passed !== true && a.passed !== false) {
          throw unprocessable(`Choose pass or fail for ${step.checkCode}`, { field: step.checkCode });
        }
      } else {
        if (!a.measuredValue?.trim()) {
          throw unprocessable(`Enter measured value for ${step.checkCode}`, { field: step.checkCode });
        }
        const within = evaluateWithinLimit(step.limitText, a.measuredValue);
        if (within === null) {
          throw unprocessable(`Could not evaluate limit for ${step.checkCode}`, {
            field: step.checkCode,
          });
        }
      }
    }

    const hasMangel = open.steps.some((step) => {
      const a = byCode.get(step.checkCode)!;
      if (step.kind === "pass_fail") return a.passed === false;
      return evaluateWithinLimit(step.limitText, a.measuredValue) === false;
    });
    if (hasMangel && !input.note?.trim()) {
      throw unprocessable("A defect requires a note.", { field: "note" });
    }

    if (open.siteId) await assertSiteInWorkAreas(ctx, open.siteId);

    const performedAt = new Date(`${open.performedAt}T00:00:00.000Z`);
    const note = input.note?.trim() || null;
    const createdIds: string[] = [];

    await prisma.$transaction(async (tx) => {
      for (const step of open.steps) {
        const a = byCode.get(step.checkCode)!;
        const isEquipment = step.scope === "equipment";
        const within =
          step.kind === "measure" ? evaluateWithinLimit(step.limitText, a.measuredValue) : null;
        const row = await tx.reprocessingCheck.create({
          data: {
            tenantId: ctx.tenantId,
            checkCode: step.checkCode,
            equipmentDeviceId: isEquipment ? deviceId : null,
            siteId: isEquipment ? null : open.siteId,
            batchId: null,
            performedAt,
            performedBy: ctx.user.name,
            performedById: ctx.user.id,
            passed: step.kind === "pass_fail" ? a.passed! : null,
            measuredValue: step.kind === "measure" ? a.measuredValue!.trim() : null,
            withinLimit: within,
            note: hasMangel ? note : note,
          },
        });
        createdIds.push(row.id);
      }
    });

    await recordAudit({
      actor: actorFromContext(ctx),
      resource: "ReprocessingCheck",
      resourceId: createdIds[0] ?? deviceId,
      action: "create",
      summary: `Tageskontrolle ${open.inventoryNumber}: ${createdIds.length} checks${hasMangel ? " (Mangel)" : ""}`,
    });

    return {
      deviceId,
      inventoryNumber: open.inventoryNumber,
      checkCount: createdIds.length,
      hasMangel,
      performedAt: open.performedAt,
      lines: open.steps.map((step) => {
        const a = byCode.get(step.checkCode)!;
        if (step.kind === "measure") {
          const within = evaluateWithinLimit(step.limitText, a.measuredValue);
          return {
            label: step.label,
            value: `${a.measuredValue}${step.unit ? ` ${step.unit}` : ""}${within ? " · im Rahmen" : " · außerhalb"}`,
          };
        }
        return {
          label: step.label,
          value: a.passed ? "in Ordnung" : "Mangel",
        };
      }),
    };
  },

  async submitForSite(
    ctx: TenantWorkContext,
    siteId: string,
    input: SubmitScanRoutineInput,
  ): Promise<ScanRoutineResultDTO> {
    requirePermission(ctx, "reprocessing:view");
    const open = await this.listOpenForSite(ctx, siteId);
    if (open.steps.length === 0) {
      throw badRequest("No open daily site checks");
    }

    const byCode = new Map(input.answers.map((a) => [a.checkCode, a]));
    for (const step of open.steps) {
      const a = byCode.get(step.checkCode);
      if (!a) {
        throw unprocessable(`Missing answer for ${step.checkCode}`, { field: step.checkCode });
      }
      if (step.kind === "pass_fail") {
        if (a.passed !== true && a.passed !== false) {
          throw unprocessable(`Choose pass or fail for ${step.checkCode}`, { field: step.checkCode });
        }
      } else {
        if (!a.measuredValue?.trim()) {
          throw unprocessable(`Enter measured value for ${step.checkCode}`, { field: step.checkCode });
        }
        const within = evaluateWithinLimit(step.limitText, a.measuredValue);
        if (within === null) {
          throw unprocessable(`Could not evaluate limit for ${step.checkCode}`, {
            field: step.checkCode,
          });
        }
      }
    }

    const hasMangel = open.steps.some((step) => {
      const a = byCode.get(step.checkCode)!;
      if (step.kind === "pass_fail") return a.passed === false;
      return evaluateWithinLimit(step.limitText, a.measuredValue) === false;
    });
    if (hasMangel && !input.note?.trim()) {
      throw unprocessable("A defect requires a note.", { field: "note" });
    }

    await assertSiteInWorkAreas(ctx, siteId);

    const performedAt = new Date(`${open.performedAt}T00:00:00.000Z`);
    const note = input.note?.trim() || null;
    const createdIds: string[] = [];

    await prisma.$transaction(async (tx) => {
      for (const step of open.steps) {
        const a = byCode.get(step.checkCode)!;
        const within =
          step.kind === "measure" ? evaluateWithinLimit(step.limitText, a.measuredValue) : null;
        const row = await tx.reprocessingCheck.create({
          data: {
            tenantId: ctx.tenantId,
            checkCode: step.checkCode,
            equipmentDeviceId: null,
            siteId,
            batchId: null,
            performedAt,
            performedBy: ctx.user.name,
            performedById: ctx.user.id,
            passed: step.kind === "pass_fail" ? a.passed! : null,
            measuredValue: step.kind === "measure" ? a.measuredValue!.trim() : null,
            withinLimit: within,
            note,
          },
        });
        createdIds.push(row.id);
      }
    });

    await recordAudit({
      actor: actorFromContext(ctx),
      resource: "ReprocessingCheck",
      resourceId: createdIds[0] ?? siteId,
      action: "create",
      summary: `Standort-Tageskontrolle ${open.siteName}: ${createdIds.length} checks${hasMangel ? " (Mangel)" : ""}`,
    });

    return {
      deviceId: "",
      inventoryNumber: open.inventoryNumber,
      checkCount: createdIds.length,
      hasMangel,
      performedAt: open.performedAt,
      lines: open.steps.map((step) => {
        const a = byCode.get(step.checkCode)!;
        if (step.kind === "measure") {
          const within = evaluateWithinLimit(step.limitText, a.measuredValue);
          return {
            label: step.label,
            value: `${a.measuredValue}${step.unit ? ` ${step.unit}` : ""}${within ? " · im Rahmen" : " · außerhalb"}`,
          };
        }
        return {
          label: step.label,
          value: a.passed ? "in Ordnung" : "Mangel",
        };
      }),
    };
  },
};
