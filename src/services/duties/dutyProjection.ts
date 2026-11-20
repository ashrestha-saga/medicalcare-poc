import type { Prisma, PrismaClient } from "@prisma/client";
import { konstanzDueAtFromCadence } from "@/services/k10/k10HardRules";
import { computeDutyDueAt } from "@/services/registration/dueDate";
import {
  isOverlapSuspensionReason,
  overlapNotApplicableReason,
} from "@/services/duties/overlapProjection";

type Tx = Prisma.TransactionClient | PrismaClient;

export type DutyProjectionResult = {
  suspended: number;
  reactivated: number;
  cadenceUpdated: number;
};

/**
 * Central duty projection for one device: re-apply DGUV covered_by_stk
 * suspensions and open constancy cadences. Call after reclassify,
 * DGUV determination, cadence determine, or any writer that replaces DeviceDuty rows.
 */
export async function recomputeDutyProjection(
  tx: Tx,
  deviceInstanceId: string,
  now = new Date(),
): Promise<DutyProjectionResult> {
  const dguvDuties = await tx.deviceDuty.findMany({
    where: { deviceInstanceId, dutyKey: "dguv" },
    select: {
      id: true,
      determinationState: true,
      basisText: true,
      notApplicableReason: true,
    },
    orderBy: { referenceDate: "desc" },
  });

  let suspended = 0;
  let reactivated = 0;

  for (const duty of dguvDuties) {
    if (duty.determinationState === "covered_by_stk") {
      const reasonText =
        duty.basisText?.trim() ||
        (isOverlapSuspensionReason(duty.notApplicableReason)
          ? duty.notApplicableReason!.slice("overlap:".length)
          : "covered_by_stk");
      const result = await tx.deviceDuty.updateMany({
        where: { id: duty.id },
        data: {
          applicable: false,
          suspendedAt: now,
          notApplicableReason: overlapNotApplicableReason(reasonText),
        },
      });
      suspended += result.count;
    } else if (isOverlapSuspensionReason(duty.notApplicableReason)) {
      // Clear STK-coverage suspension when Festlegung is no longer covered_by_stk.
      // Do not touch not_applicable (no overlap: prefix) or other supersession reasons.
      const result = await tx.deviceDuty.updateMany({
        where: { id: duty.id },
        data: {
          applicable: true,
          suspendedAt: null,
          notApplicableReason: null,
        },
      });
      reactivated += result.count;
    }
  }

  const cadences = await tx.constancyCadence.findMany({
    where: { deviceInstanceId, validTo: null },
    select: {
      constancyObjectCode: true,
      intervalValue: true,
      intervalUnit: true,
      determinedAt: true,
    },
  });

  let cadenceUpdated = 0;
  for (const c of cadences) {
    const unit =
      c.intervalUnit === "years"
        ? "years"
        : c.intervalUnit === "working_days"
          ? "working_days"
          : "months";
    const duties = await tx.deviceDuty.findMany({
      where: {
        deviceInstanceId,
        dutyKey: "konstanz",
        constancyObjectCode: c.constancyObjectCode,
        applicable: true,
        suspendedAt: null,
      },
      select: { id: true },
    });
    for (const duty of duties) {
      const dueAt = konstanzDueAtFromCadence(
        {
          intervalValue: c.intervalValue,
          intervalUnit: unit,
          determinedAt: c.determinedAt,
        },
        computeDutyDueAt,
      );
      await tx.deviceDuty.update({
        where: { id: duty.id },
        data: {
          intervalValue: c.intervalValue,
          intervalUnit: unit,
          ...(unit === "working_days" ? { deadlineAnchor: "exact_day" as const } : {}),
          dueAt,
          cadenceLabel:
            unit === "working_days"
              ? `${c.intervalValue} working day${c.intervalValue === 1 ? "" : "s"}`
              : `${c.intervalValue} ${unit}`,
        },
      });
      cadenceUpdated += 1;
    }
  }

  return { suspended, reactivated, cadenceUpdated };
}

/** Re-apply projection for every device that has covered_by_stk DGUV or an open cadence. */
export async function backfillDutyProjections(
  client: PrismaClient,
): Promise<{ devices: number }> {
  const [coveredDevices, cadenceDevices] = await Promise.all([
    client.deviceDuty.findMany({
      where: { dutyKey: "dguv", determinationState: "covered_by_stk" },
      select: { deviceInstanceId: true },
      distinct: ["deviceInstanceId"],
    }),
    client.constancyCadence.findMany({
      where: { validTo: null },
      select: { deviceInstanceId: true },
      distinct: ["deviceInstanceId"],
    }),
  ]);
  const ids = new Set([
    ...coveredDevices.map((r) => r.deviceInstanceId),
    ...cadenceDevices.map((r) => r.deviceInstanceId),
  ]);
  for (const deviceInstanceId of ids) {
    await recomputeDutyProjection(client, deviceInstanceId);
  }
  return { devices: ids.size };
}
