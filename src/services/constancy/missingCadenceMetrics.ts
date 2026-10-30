import { prisma } from "@/lib/prisma";

function openKey(deviceInstanceId: string, constancyObjectCode: string): string {
  return `${deviceInstanceId}:${constancyObjectCode}`;
}

/**
 * One definition of “Konstanz without takt”: applicable konstanz duties
 * that name an object and have no open ConstancyCadence for that object.
 * Used by nav, commissioning, Today, and the constancy page.
 */
export async function countMissingConstancyCadences(): Promise<number> {
  const [duties, open] = await Promise.all([
    prisma.deviceDuty.findMany({
      where: {
        dutyKey: "konstanz",
        applicable: true,
        suspendedAt: null,
        constancyObjectCode: { not: null },
        deviceInstance: { state: { not: "retired" } },
      },
      select: { deviceInstanceId: true, constancyObjectCode: true },
    }),
    prisma.constancyCadence.findMany({
      where: { validTo: null },
      select: { deviceInstanceId: true, constancyObjectCode: true },
    }),
  ]);
  const openSet = new Set(open.map((o) => openKey(o.deviceInstanceId, o.constancyObjectCode)));
  return duties.filter(
    (d) => d.constancyObjectCode && !openSet.has(openKey(d.deviceInstanceId, d.constancyObjectCode)),
  ).length;
}
