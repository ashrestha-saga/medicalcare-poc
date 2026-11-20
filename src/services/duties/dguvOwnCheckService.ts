/**
 * E85 / R33 — own-staff DGUV short check with measurements + Plakette.
 */
import type { TenantWorkContext } from "@/interfaces";
import { actorFromContext } from "@/lib/auth/actorContext";
import { requirePermission } from "@/lib/auth/tenantContext";
import { notFound, unprocessable } from "@/lib/errors";
import { requireRadiationDguvEnabled } from "@/lib/features/radiationDguv";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import { addMonthsUtc } from "@/lib/maintenance/schedule";
import { computeDutyDueAt } from "@/services/registration/dueDate";
import type { DguvShortCompleteInput } from "@/schemas/radiationDguv";

async function requireFlag(ctx: TenantWorkContext) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { featureFlags: true },
  });
  requireRadiationDguvEnabled(tenant?.featureFlags);
}

/**
 * Seed / create leave deadlineAnchor="interval" (TBD until Festlegung).
 * After an interval is set, advance as exact_day so dueAt is not wiped to null.
 */
function nextDueAfterDguvCheck(duty: {
  deadlineAnchor: string;
  referenceDate: Date;
  intervalValue: number | null;
  intervalUnit: string | null;
}, performedAt: Date): { dueAt: Date | null; deadlineAnchor: string } {
  const intervalValue = duty.intervalValue ?? 24;
  const intervalUnit = duty.intervalUnit ?? "months";
  const anchor =
    duty.deadlineAnchor === "interval" ||
    duty.deadlineAnchor === "event" ||
    duty.deadlineAnchor === "process" ||
    duty.deadlineAnchor === "permanent" ||
    duty.deadlineAnchor === "none" ||
    duty.deadlineAnchor === "reference"
      ? "exact_day"
      : duty.deadlineAnchor;

  const dueAt =
    computeDutyDueAt({
      deadlineAnchor: anchor,
      referenceDate: duty.referenceDate,
      lastCompletedAt: performedAt,
      intervalValue,
      intervalUnit,
    }) ??
    (intervalUnit === "months" || intervalUnit === "years"
      ? addMonthsUtc(
          performedAt,
          intervalUnit === "years" ? intervalValue * 12 : intervalValue,
        )
      : null);

  return { dueAt, deadlineAnchor: anchor };
}

export const dguvOwnCheckService = {
  async complete(ctx: TenantWorkContext, dutyId: string, input: DguvShortCompleteInput) {
    // Scan capturers use inventory:view; clinic editors use inventory:update.
    requirePermission(ctx, "inventory:update", "inventory:view");
    await requireFlag(ctx);

    const duty = await prisma.deviceDuty.findFirst({
      where: { id: dutyId, tenantId: ctx.tenantId },
    });
    if (!duty) throw notFound("Duty not found");
    if (duty.dutyKey !== "dguv") {
      throw unprocessable("dguv_short only applies to DGUV duties", { field: "kind" });
    }
    if (duty.suspendedAt || !duty.applicable) {
      throw unprocessable("DGUV duty is not active");
    }
    if (duty.determinationState !== "own_check") {
      throw unprocessable("Own check requires determinationState=own_check", {
        field: "determinationState",
      });
    }

    const outOfLimit = input.measurements.some((m) => !m.withinLimit);
    if (outOfLimit && input.result === "passed") {
      throw unprocessable("Result passed is implausible when a measurement is outside limit", {
        field: "result",
      });
    }

    if (input.result === "passed" && !input.labelNumber) {
      throw unprocessable("labelNumber required on pass", { field: "labelNumber" });
    }

    const performedAt = input.performedAt?.trim()
      ? new Date(input.performedAt)
      : new Date();
    if (Number.isNaN(performedAt.getTime())) {
      throw unprocessable("Invalid performedAt", { field: "performedAt" });
    }

    const interval = duty.intervalValue ?? 24;
    const labelNextDue =
      input.result === "passed" ? addMonthsUtc(performedAt, interval) : null;

    const { dueAt: nextDue, deadlineAnchor } = nextDueAfterDguvCheck(duty, performedAt);

    const actor = actorFromContext(ctx);

    const performance = await prisma.$transaction(async (tx) => {
      const perf = await tx.dutyPerformance.create({
        data: {
          tenantId: ctx.tenantId,
          deviceDutyId: duty.id,
          performedAt,
          result: input.result,
          note: input.note?.trim() || null,
          performedBy: input.performedBy.trim(),
          performedByUserId: ctx.user.id,
          source: "manual",
          labelNumber: input.result === "passed" ? input.labelNumber! : null,
          labelNextDue,
          measurementsJson: input.measurements,
        },
      });

      await tx.deviceDuty.update({
        where: { id: duty.id },
        data: {
          lastCompletedAt: performedAt,
          dueAt: nextDue,
          deadlineAnchor,
          intervalValue: duty.intervalValue ?? interval,
          intervalUnit: duty.intervalUnit ?? "months",
          notifyStage: null,
          lastNotifiedAt: null,
        },
      });

      await tx.deviceUnitEvent.create({
        data: {
          tenantId: ctx.tenantId,
          deviceInstanceId: duty.deviceInstanceId,
          actor: input.performedBy.trim(),
          action: "dguv_own_check",
          note: [
            input.result,
            input.labelNumber ? `Plakette ${input.labelNumber}` : null,
            nextDue ? `next ${nextDue.toISOString().slice(0, 10)}` : null,
          ]
            .filter(Boolean)
            .join(" · "),
        },
      });

      return perf;
    });

    await recordAudit({
      actor,
      resource: "DutyPerformance",
      resourceId: performance.id,
      action: "dguv_own_check",
      summary: `DGUV own check ${input.result}${input.labelNumber ? ` · ${input.labelNumber}` : ""}`,
    });

    return {
      performanceId: performance.id,
      labelNumber: performance.labelNumber,
      labelNextDue: performance.labelNextDue?.toISOString().slice(0, 10) ?? null,
      dueAt: nextDue?.toISOString() ?? null,
    };
  },
};
