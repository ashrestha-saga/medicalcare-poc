import { prisma } from "@/lib/prisma";

export async function getActiveBaseline(args: {
  tenantId: string;
  deviceInstanceId: string;
  measureKey: string;
}): Promise<{ value: string; unit: string | null } | null> {
  const row = await prisma.baselineMeasurement.findFirst({
    where: {
      tenantId: args.tenantId,
      deviceInstanceId: args.deviceInstanceId,
      measureKey: args.measureKey,
      validTo: null,
    },
    orderBy: { validFrom: "desc" },
    select: { value: true, unit: true },
  });
  return row;
}

export async function writeBaselinesFromRun(args: {
  tenantId: string;
  deviceInstanceId: string;
  runId: string;
  recordedBy: string;
  entries: { measureKey: string; value: string; unit?: string | null }[];
}): Promise<void> {
  for (const entry of args.entries) {
    await prisma.baselineMeasurement.updateMany({
      where: {
        tenantId: args.tenantId,
        deviceInstanceId: args.deviceInstanceId,
        measureKey: entry.measureKey,
        validTo: null,
      },
      data: { validTo: new Date() },
    });
    await prisma.baselineMeasurement.create({
      data: {
        tenantId: args.tenantId,
        deviceInstanceId: args.deviceInstanceId,
        measureKey: entry.measureKey,
        value: entry.value,
        unit: entry.unit ?? null,
        runId: args.runId,
        recordedBy: args.recordedBy,
      },
    });
  }
}
