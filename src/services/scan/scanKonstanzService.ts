import type {
  ScanKonstanzItemDTO,
  ScanKonstanzOpenDTO,
  ScanKonstanzResultDTO,
  TenantWorkContext,
} from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { actorFromContext } from "@/lib/auth/actorContext";
import { badRequest, notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import { recordDutyCompletion } from "@/services/registration/recordDutyCompletion";
import type { SubmitScanKonstanzInput } from "@/schemas/k10";
import { assertDeviceInWorkAreas } from "@/services/users/userAreaScope";
import {
  captureDefaultsForObject,
  referenceRowsFromJson,
  visualCheckpointsFor,
} from "@/lib/constancy/captureDefaults";

function withinTolerance(
  measured: number,
  ref: { value: number; tolerancePct?: number | null; toleranceAbs?: number | null },
): boolean {
  if (ref.toleranceAbs != null) return Math.abs(measured - ref.value) <= ref.toleranceAbs;
  if (ref.tolerancePct != null) {
    return Math.abs(measured - ref.value) <= (Math.abs(ref.value) * ref.tolerancePct) / 100;
  }
  return measured === ref.value;
}

function startOfTodayUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

function isoDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

async function baselineDoneForDevice(deviceInstanceId: string, tenantId: string): Promise<boolean> {
  const baseline = await prisma.deviceDuty.findFirst({
    where: {
      deviceInstanceId,
      tenantId,
      setsBaseline: true,
      applicable: true,
      suspendedAt: null,
    },
    include: {
      performances: { take: 1, orderBy: { performedAt: "desc" } },
    },
  });
  return Boolean(baseline?.lastCompletedAt) || (baseline?.performances?.length ?? 0) > 0;
}

/**
 * Pass/conditions that clear a prior fail/deviation.
 * Compare recordedAt — performedAt is date-only, so same-day retest must still clear.
 */
async function laterSuccessfulPerformance(
  deviceDutyId: string,
  afterRecordedAt: Date,
): Promise<boolean> {
  const laterOk = await prisma.dutyPerformance.findFirst({
    where: {
      deviceDutyId,
      recordedAt: { gt: afterRecordedAt },
      result: { in: ["passed", "passed_with_conditions"] },
    },
    select: { id: true },
  });
  return Boolean(laterOk);
}

async function latestUnclearedKonstanzFail(deviceId: string): Promise<{
  performedAt: Date;
  recordedAt: Date;
  deviceDutyId: string;
  note: string | null;
  title: string;
} | null> {
  const fails = await prisma.dutyPerformance.findMany({
    where: {
      result: { in: ["failed", "deviation"] },
      deviceDuty: {
        deviceInstanceId: deviceId,
        dutyKey: "konstanz",
        applicable: true,
        suspendedAt: null,
      },
    },
    orderBy: { recordedAt: "desc" },
    take: 50,
    select: {
      performedAt: true,
      recordedAt: true,
      deviceDutyId: true,
      note: true,
      deviceDuty: { select: { title: true, constancyObjectCode: true } },
    },
  });
  for (const failed of fails) {
    const cleared = await laterSuccessfulPerformance(failed.deviceDutyId, failed.recordedAt);
    if (!cleared) {
      return {
        performedAt: failed.performedAt,
        recordedAt: failed.recordedAt,
        deviceDutyId: failed.deviceDutyId,
        note: failed.note,
        title: failed.deviceDuty.title ?? failed.deviceDuty.constancyObjectCode ?? "Konstanz",
      };
    }
  }
  return null;
}

export async function deviceHasOpenKonstanz(deviceId: string): Promise<boolean> {
  const today = startOfTodayUtc();
  const due = await prisma.deviceDuty.findFirst({
    where: {
      deviceInstanceId: deviceId,
      dutyKey: "konstanz",
      applicable: true,
      suspendedAt: null,
      dueAt: { lte: today },
    },
    select: { id: true },
  });
  if (due) return true;

  return Boolean(await latestUnclearedKonstanzFail(deviceId));
}

export async function deriveKonstanzSperr(deviceId: string): Promise<{
  lage: "stop" | "warn";
  quelle: "konstanz";
  grund: string;
} | null> {
  const failed = await latestUnclearedKonstanzFail(deviceId);
  if (failed) {
    const d = failed.performedAt.toISOString().slice(0, 10);
    return {
      lage: "stop",
      quelle: "konstanz",
      grund: `Konstanzprüfung am ${d} nicht bestanden (${failed.title})${failed.note ? `: ${failed.note}` : ""}`,
    };
  }

  const today = startOfTodayUtc();
  const overdue = await prisma.deviceDuty.findFirst({
    where: {
      deviceInstanceId: deviceId,
      dutyKey: "konstanz",
      applicable: true,
      suspendedAt: null,
      dueAt: { lt: today },
    },
    orderBy: { dueAt: "asc" },
    select: { dueAt: true, title: true, constancyObjectCode: true },
  });
  if (overdue?.dueAt) {
    const title = overdue.title ?? overdue.constancyObjectCode ?? "Konstanz";
    return {
      lage: "warn",
      quelle: "konstanz",
      grund: `Konstanzprüfung überfällig seit ${isoDate(overdue.dueAt)} (${title})`,
    };
  }

  return null;
}

export const scanKonstanzService = {
  async listOpen(ctx: TenantWorkContext, deviceId: string): Promise<ScanKonstanzOpenDTO> {
    requirePermission(ctx, "inventory:view");
    const device = await prisma.deviceInstance.findFirst({
      where: { id: deviceId },
      select: {
        id: true,
        inventoryNumber: true,
        areaId: true,
        model: { select: { tradeName: true, modelName: true } },
      },
    });
    if (!device) throw notFound("Device not found");
    await assertDeviceInWorkAreas(ctx, device.areaId);

    const today = startOfTodayUtc();
    const hasBaseline = await baselineDoneForDevice(deviceId, ctx.tenantId);
    const duties = await prisma.deviceDuty.findMany({
      where: {
        deviceInstanceId: deviceId,
        dutyKey: "konstanz",
        applicable: true,
        suspendedAt: null,
      },
      include: {
        constancyObject: { select: { label: true } },
        performances: {
          orderBy: { recordedAt: "desc" },
          take: 1,
          select: { result: true, performedAt: true, note: true, performedBy: true, recordedAt: true },
        },
      },
      orderBy: [{ dueAt: "asc" }, { title: "asc" }],
    });

    const objectCodes = [
      ...new Set(duties.map((d) => d.constancyObjectCode).filter((c): c is string => Boolean(c))),
    ];
    const cadences =
      objectCodes.length === 0
        ? []
        : await prisma.constancyCadence.findMany({
            where: {
              tenantId: ctx.tenantId,
              deviceInstanceId: deviceId,
              validTo: null,
              constancyObjectCode: { in: objectCodes },
            },
          });
    const cadenceByCode = new Map(cadences.map((c) => [c.constancyObjectCode, c]));

    const items: ScanKonstanzItemDTO[] = [];
    for (const d of duties) {
      const last = d.performances[0] ?? null;
      const cadence = d.constancyObjectCode
        ? cadenceByCode.get(d.constancyObjectCode)
        : undefined;

      let status: ScanKonstanzItemDTO["status"] = "ok";
      if (d.requiresBaseline && !hasBaseline) status = "baseline_missing";
      else if (!cadence || d.dueAt == null) status = "missing_cadence";
      else if (last?.result === "failed" || last?.result === "deviation") status = "failed";
      else if (d.dueAt < today) status = "overdue";
      else if (isoDate(d.dueAt) === isoDate(today)) status = "due";
      else status = "ok";

      const canComplete =
        status === "due" || status === "overdue" || status === "failed";

      if (status === "ok") continue;

      const defaults = captureDefaultsForObject(d.constancyObjectCode);
      const captureMode =
        cadence?.captureMode === "manual_measurement" || cadence?.captureMode === "visual"
          ? cadence.captureMode
          : cadence?.captureMode === "device_protocol"
            ? "device_protocol"
            : defaults.captureMode;
      const refs = referenceRowsFromJson(cadence?.referenceValuesJson);
      const checkpoints = visualCheckpointsFor(
        d.constancyObjectCode,
        cadence?.referenceValuesJson,
      );

      items.push({
        dutyId: d.id,
        title: d.title ?? d.constancyObject?.label ?? d.dutyKey,
        constancyObjectCode: d.constancyObjectCode,
        constancyObjectLabel: d.constancyObject?.label ?? null,
        dueAt: isoDate(d.dueAt),
        status,
        canComplete,
        requiresBaseline: d.requiresBaseline,
        lastResult: last?.result ?? null,
        lastPerformedAt: isoDate(last?.performedAt ?? null),
        basisText: d.basisText,
        captureMode,
        protocolSource: cadence?.protocolSource ?? defaults.protocolSource,
        referenceValues: refs.length
          ? refs
          : (defaults.referenceValues ?? []).map((r) => ({
              name: r.name,
              value: r.value,
              unit: r.unit,
              tolerancePct: r.tolerancePct ?? null,
              toleranceAbs: r.toleranceAbs ?? null,
            })),
        visualCheckpoints: checkpoints.length
          ? checkpoints
          : (defaults.visualCheckpoints ?? []),
      });
    }

    // Today's performances — shown when the form has nothing left to do.
    const dutyIds = duties.map((d) => d.id);
    const todayRows =
      dutyIds.length === 0
        ? []
        : await prisma.dutyPerformance.findMany({
            where: {
              tenantId: ctx.tenantId,
              performedAt: today,
              deviceDutyId: { in: dutyIds },
            },
            include: {
              deviceDuty: {
                select: {
                  id: true,
                  title: true,
                  dueAt: true,
                  constancyObject: { select: { label: true } },
                },
              },
            },
            orderBy: { recordedAt: "asc" },
          });

    const seenDuty = new Set<string>();
    const completedToday = [];
    for (const row of todayRows) {
      if (seenDuty.has(row.deviceDutyId)) continue;
      seenDuty.add(row.deviceDutyId);
      completedToday.push({
        dutyId: row.deviceDutyId,
        title:
          row.deviceDuty.title ??
          row.deviceDuty.constancyObject?.label ??
          "Konstanz",
        constancyObjectLabel: row.deviceDuty.constancyObject?.label ?? null,
        result: row.result as "passed" | "passed_with_conditions" | "failed",
        note: row.note,
        performedBy: row.performedBy,
        performedAt: isoDate(row.performedAt)!,
        recordedAt: row.recordedAt.toISOString(),
        nextDueAt: isoDate(row.deviceDuty.dueAt),
      });
    }

    const label =
      device.model?.tradeName?.trim() ||
      device.model?.modelName?.trim() ||
      device.inventoryNumber;

    return {
      deviceId: device.id,
      inventoryNumber: device.inventoryNumber,
      label,
      performedAt: isoDate(today)!,
      items,
      completedToday,
    };
  },

  async submit(
    ctx: TenantWorkContext,
    deviceId: string,
    input: SubmitScanKonstanzInput,
  ): Promise<ScanKonstanzResultDTO> {
    requirePermission(ctx, "inventory:view");
    const open = await this.listOpen(ctx, deviceId);
    const item = open.items.find((i) => i.dutyId === input.dutyId);
    if (!item) throw notFound("Constancy duty not open on this device");
    if (!item.canComplete) {
      throw unprocessable(
        item.status === "missing_cadence"
          ? "Constancy takt must be determined before the check can be recorded."
          : item.status === "baseline_missing"
            ? "Baseline / acceptance must be recorded before constancy."
            : "This constancy duty cannot be completed yet.",
        { field: "dutyId", code: item.status },
      );
    }

    if (
      (input.result === "failed" ||
        input.result === "passed_with_conditions" ||
        input.result === "deviation") &&
      !input.note?.trim() &&
      item.captureMode !== "manual_measurement" &&
      item.captureMode !== "visual"
    ) {
      throw unprocessable("Note required for failed or conditional result.", { field: "note" });
    }

    const duty = await prisma.deviceDuty.findFirst({
      where: {
        id: input.dutyId,
        deviceInstanceId: deviceId,
        dutyKey: "konstanz",
        applicable: true,
        suspendedAt: null,
      },
    });
    if (!duty) throw notFound("Duty not found");

    const performedAt = input.performedAt
      ? new Date(`${input.performedAt}T12:00:00.000Z`)
      : startOfTodayUtc();
    if (Number.isNaN(performedAt.getTime())) {
      throw badRequest("Invalid performedAt date");
    }

    const mode = input.captureMode ?? item.captureMode;
    let result = input.result;
    let measurementsJson: unknown = null;

    if (mode === "manual_measurement") {
      const refs = item.referenceValues;
      if (!refs.length) {
        throw unprocessable("No reference values for measurement mode", {
          field: "measurements",
        });
      }
      const rows = input.measurements ?? [];
      if (rows.length < refs.length) {
        throw unprocessable("Every reference row needs a measurement", {
          field: "measurements",
        });
      }
      let anyOut = false;
      const evaluated = refs.map((ref) => {
        const m =
          rows.find((x) => x.name === ref.name) ?? rows[refs.indexOf(ref)];
        const ok = withinTolerance(m.value, ref);
        if (!ok) anyOut = true;
        return {
          name: ref.name,
          value: m.value,
          unit: m.unit || ref.unit,
          withinLimit: ok,
        };
      });
      measurementsJson = evaluated;
      if (anyOut) result = "deviation";
    } else if (mode === "visual") {
      const points = item.visualCheckpoints;
      const findings = input.visualFindings ?? [];
      if (points.length) {
        for (const point of points) {
          const f = findings.find((x) => x.point === point);
          if (!f) {
            throw unprocessable(`Missing visual finding for: ${point}`, {
              field: "visualFindings",
            });
          }
          if (!f.ok && !f.finding?.trim()) {
            throw unprocessable("Finding text required for failed checkpoints", {
              field: "visualFindings",
            });
          }
        }
        measurementsJson = findings;
        if (findings.some((f) => !f.ok)) result = "failed";
      }
    }

    if (
      (result === "failed" || result === "passed_with_conditions" || result === "deviation") &&
      !input.note?.trim() &&
      mode === "device_protocol"
    ) {
      throw unprocessable("Note required for failed or conditional result.", { field: "note" });
    }

    const retentionUntil = new Date(performedAt);
    retentionUntil.setUTCFullYear(retentionUntil.getUTCFullYear() + 10);

    const { nextDue } = await prisma.$transaction(async (tx) =>
      recordDutyCompletion(tx, {
        tenantId: ctx.tenantId,
        duty,
        performedAt,
        performedBy: ctx.user.name,
        actorUserId: ctx.user.id,
        note: input.note?.trim() || null,
        source: "scan",
        result:
          result === "deviation"
            ? "deviation"
            : result === "failed"
              ? "failed"
              : result === "passed_with_conditions"
                ? "passed_with_conditions"
                : "passed",
        captureMode: mode,
        measurementsJson: measurementsJson ?? undefined,
        retentionUntil,
      }),
    );

    await recordAudit({
      actor: actorFromContext(ctx),
      resource: "duty",
      resourceId: duty.id,
      action: "complete",
      summary: `Scan Konstanz ${item.title} → ${result}`,
    });

    return {
      deviceId,
      inventoryNumber: open.inventoryNumber,
      dutyId: duty.id,
      title: item.title,
      result:
        result === "deviation"
          ? "failed"
          : result === "passed_with_conditions"
            ? "passed_with_conditions"
            : result === "failed"
              ? "failed"
              : "passed",
      performedAt: isoDate(performedAt)!,
      nextDueAt: isoDate(nextDue),
      note: input.note?.trim() || null,
    };
  },
};
