import type { PrismaClient } from "@prisma/client";
import {
  resolveUserIdForName,
  uniqueNameToUserId,
} from "@/services/attribution/backfillNameAttribution";

/**
 * Best-effort: set DutyPerformance.performedByUserId / DeviceEvidence.recordedByUserId
 * when the frozen name uniquely matches a User (same tenant when the user has tenantId).
 */
export async function backfillDutyAndEvidenceAttribution(
  client: PrismaClient,
): Promise<{ dutyPerformances: number; evidence: number }> {
  const users = await client.user.findMany({
    select: { id: true, name: true, tenantId: true },
  });

  let dutyPerformances = 0;
  let evidence = 0;

  const openPerf = await client.dutyPerformance.findMany({
    where: { performedByUserId: null },
    select: { id: true, performedBy: true, tenantId: true },
    take: 5000,
  });
  for (const row of openPerf) {
    const map = uniqueNameToUserId(users, { tenantId: row.tenantId });
    // Also allow matching partner users (tenantId null) when name is globally unique among remaining.
    const global = uniqueNameToUserId(users);
    const userId =
      resolveUserIdForName(row.performedBy, map) ?? resolveUserIdForName(row.performedBy, global);
    if (!userId) continue;
    await client.dutyPerformance.update({
      where: { id: row.id },
      data: { performedByUserId: userId },
    });
    dutyPerformances += 1;
  }

  const openEv = await client.deviceEvidence.findMany({
    where: { recordedByUserId: null },
    select: { id: true, recordedBy: true, tenantId: true },
    take: 5000,
  });
  for (const row of openEv) {
    const map = uniqueNameToUserId(users, { tenantId: row.tenantId });
    const global = uniqueNameToUserId(users);
    const userId =
      resolveUserIdForName(row.recordedBy, map) ?? resolveUserIdForName(row.recordedBy, global);
    if (!userId) continue;
    await client.deviceEvidence.update({
      where: { id: row.id },
      data: { recordedByUserId: userId },
    });
    evidence += 1;
  }

  return { dutyPerformances, evidence };
}
