import type { Prisma } from "@prisma/client";
import { computeDutyDueAt } from "./dueDate";

export type DutyCompletionResult = "passed" | "passed_with_conditions" | "failed";

export interface RecordDutyCompletionArgs {
  tenantId: string;
  duty: {
    id: string;
    deviceInstanceId: string;
    dutyKey: string;
    title: string | null;
    deadlineAnchor: string;
    referenceDate: Date;
    intervalValue: number | null;
    intervalUnit: string | null;
    dueAt: Date | null;
    inspectionTypeCode: string;
  };
  performedAt: Date;
  performedBy: string;
  /** Actor user id when available (MaintenanceEvent.actorUserId). */
  actorUserId?: string | null;
  note?: string | null;
  source: string;
  serviceRequestId?: string | null;
  result?: DutyCompletionResult;
  /** Extra note fragment for DeviceUnitEvent (e.g. "via assignment"). */
  unitEventSuffix?: string | null;
}

/**
 * SCH-09 — single completion path:
 * always creates DutyPerformance + rolls duty due;
 * for wartung/MAINT also writes MaintenanceEvent and instance maintenance fields.
 */
export async function recordDutyCompletion(
  tx: Prisma.TransactionClient,
  args: RecordDutyCompletionArgs,
): Promise<{ nextDue: Date | null; dutyPerformanceId: string }> {
  const d = args.duty;
  const nextDue = computeDutyDueAt({
    deadlineAnchor: d.deadlineAnchor,
    referenceDate: d.referenceDate,
    lastCompletedAt: args.performedAt,
    intervalValue: d.intervalValue,
    intervalUnit: d.intervalUnit,
  });

  const performance = await tx.dutyPerformance.create({
    data: {
      tenantId: args.tenantId,
      deviceDutyId: d.id,
      serviceRequestId: args.serviceRequestId ?? null,
      performedAt: args.performedAt,
      result: args.result ?? "passed",
      note: args.note ?? null,
      performedBy: args.performedBy,
      source: args.source,
    },
  });

  await tx.deviceDuty.update({
    where: { id: d.id },
    data: {
      lastCompletedAt: args.performedAt,
      dueAt: nextDue,
      notifyStage: null,
      lastNotifiedAt: null,
    },
  });

  await tx.deviceUnitEvent.create({
    data: {
      tenantId: args.tenantId,
      deviceInstanceId: d.deviceInstanceId,
      actor: args.performedBy,
      action: "duty_complete",
      note: [
        d.title ?? d.dutyKey,
        nextDue ? `next due ${nextDue.toISOString().slice(0, 10)}` : "no calendar due",
        args.note?.trim() || null,
        args.unitEventSuffix ?? null,
      ]
        .filter(Boolean)
        .join(" — "),
    },
  });

  const isWartung = d.dutyKey === "wartung" || d.inspectionTypeCode === "MAINT";
  if (isWartung) {
    const instance = await tx.deviceInstance.findFirst({
      where: { id: d.deviceInstanceId, tenantId: args.tenantId },
    });
    if (instance) {
      const cycleMonths =
        d.intervalUnit === "months"
          ? d.intervalValue
          : d.intervalUnit === "years" && d.intervalValue != null
            ? d.intervalValue * 12
            : instance.maintenanceCycleMonths;
      await tx.deviceInstance.update({
        where: { id: instance.id },
        data: {
          lastMaintainedAt: args.performedAt,
          nextMaintenanceDueAt: nextDue,
          ...(cycleMonths != null ? { maintenanceCycleMonths: cycleMonths } : {}),
        },
      });
      await tx.maintenanceEvent.create({
        data: {
          tenantId: args.tenantId,
          deviceInstanceId: instance.id,
          kind: "completed",
          performedAt: args.performedAt,
          previousDueAt: d.dueAt,
          nextDueAt: nextDue,
          cycleMonths: cycleMonths ?? null,
          note: args.note ?? null,
          actorUserId: args.actorUserId ?? null,
        },
      });
    }
  }

  return { nextDue, dutyPerformanceId: performance.id };
}
