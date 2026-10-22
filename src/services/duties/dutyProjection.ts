import type { DutyKey, Prisma, PrismaClient } from "@prisma/client";
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
 * Central duty projection for one device: re-apply open overlap suspensions
 * and open constancy cadences. Call after reclassify, overlap decide/revoke,
 * cadence determine, or any writer that replaces DeviceDuty rows.
 */
export async function recomputeDutyProjection(
  tx: Tx,
  deviceInstanceId: string,
  now = new Date(),
): Promise<DutyProjectionResult> {
  const openOverlaps = await tx.dutyOverlapDecision.findMany({
    where: { deviceInstanceId, validTo: null },
    select: { coveredDutyKey: true, reasonText: true },
    orderBy: { decidedAt: "desc" },
  });

  /** First (newest) open reason wins per covered key. */
  const coveredReason = new Map<string, string>();
  for (const row of openOverlaps) {
    if (!coveredReason.has(row.coveredDutyKey)) {
      coveredReason.set(row.coveredDutyKey, row.reasonText);
    }
  }

  let suspended = 0;
  for (const [dutyKey, reasonText] of coveredReason) {
    const result = await tx.deviceDuty.updateMany({
      where: {
        deviceInstanceId,
        dutyKey: dutyKey as DutyKey,
      },
      data: {
        applicable: false,
        suspendedAt: now,
        notApplicableReason: overlapNotApplicableReason(reasonText),
      },
    });
    suspended += result.count;
  }

  const candidates = await tx.deviceDuty.findMany({
    where: { deviceInstanceId },
    select: {
      id: true,
      dutyKey: true,
      notApplicableReason: true,
    },
  });
  const reactivateIds = candidates
    .filter(
      (d) =>
        isOverlapSuspensionReason(d.notApplicableReason) && !coveredReason.has(d.dutyKey),
    )
    .map((d) => d.id);

  let reactivated = 0;
  if (reactivateIds.length > 0) {
    const result = await tx.deviceDuty.updateMany({
      where: { id: { in: reactivateIds } },
      data: {
        applicable: true,
        suspendedAt: null,
        notApplicableReason: null,
      },
    });
    reactivated = result.count;
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
    const unit = c.intervalUnit === "years" ? "years" : "months";
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
          dueAt,
          cadenceLabel: `${c.intervalValue} ${unit}`,
        },
      });
      cadenceUpdated += 1;
    }
  }

  return { suspended, reactivated, cadenceUpdated };
}

/** Re-apply projection for every device that has an open overlap or cadence. */
export async function backfillDutyProjections(
  client: PrismaClient,
): Promise<{ devices: number }> {
  const [overlapDevices, cadenceDevices] = await Promise.all([
    client.dutyOverlapDecision.findMany({
      where: { validTo: null },
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
    ...overlapDevices.map((r) => r.deviceInstanceId),
    ...cadenceDevices.map((r) => r.deviceInstanceId),
  ]);
  for (const deviceInstanceId of ids) {
    await recomputeDutyProjection(client, deviceInstanceId);
  }
  return { devices: ids.size };
}
