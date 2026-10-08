import { prisma } from "@/lib/prisma";

export interface TestEquipmentGateResult {
  ok: boolean;
  requiredClass: string | null;
  instruments: {
    id: string;
    label: string;
    serialNumber: string | null;
    calibratedUntil: string | null;
    traceabilityRef: string | null;
  }[];
  blockedReason: string | null;
}

export async function listEligibleEquipment(args: {
  organisationId: string;
  classCode: string | null;
}): Promise<TestEquipmentGateResult["instruments"]> {
  if (!args.classCode) return [];
  const rows = await prisma.testEquipment.findMany({
    where: {
      organisationId: args.organisationId,
      classCode: args.classCode,
      active: true,
    },
    orderBy: { label: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    serialNumber: r.serialNumber,
    calibratedUntil: r.calibratedUntil?.toISOString().slice(0, 10) ?? null,
    traceabilityRef: r.traceabilityRef,
  }));
}

export async function checkTestEquipmentGate(args: {
  organisationId: string;
  testEquipmentClass: string | null;
  testEquipmentId: string | null;
  performanceDate: Date;
  traceabilityRequired?: boolean;
}): Promise<TestEquipmentGateResult> {
  const instruments = await listEligibleEquipment({
    organisationId: args.organisationId,
    classCode: args.testEquipmentClass,
  });

  if (!args.testEquipmentClass) {
    return {
      ok: true,
      requiredClass: null,
      instruments: [],
      blockedReason: null,
    };
  }

  if (!args.testEquipmentId) {
    return {
      ok: false,
      requiredClass: args.testEquipmentClass,
      instruments,
      blockedReason: "equipment_required",
    };
  }

  const instrument = await prisma.testEquipment.findFirst({
    where: {
      id: args.testEquipmentId,
      organisationId: args.organisationId,
      classCode: args.testEquipmentClass,
      active: true,
    },
  });

  if (!instrument) {
    return {
      ok: false,
      requiredClass: args.testEquipmentClass,
      instruments,
      blockedReason: "equipment_invalid",
    };
  }

  if (instrument.calibratedUntil && instrument.calibratedUntil < args.performanceDate) {
    return {
      ok: false,
      requiredClass: args.testEquipmentClass,
      instruments,
      blockedReason: "calibration_lapsed",
    };
  }

  if (args.traceabilityRequired && !instrument.traceabilityRef?.trim()) {
    return {
      ok: false,
      requiredClass: args.testEquipmentClass,
      instruments,
      blockedReason: "traceability_missing",
    };
  }

  return {
    ok: true,
    requiredClass: args.testEquipmentClass,
    instruments,
    blockedReason: null,
  };
}
