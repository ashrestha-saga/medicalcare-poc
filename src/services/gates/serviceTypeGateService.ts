/**
 * E89 / R37 — service-type qualification gates (sv | konstanz | dguv).
 */
import type { GateOverridableBy } from "@prisma/client";
import { AppError, forbidden, unprocessable } from "@/lib/errors";
import { isRadiationDguvEnabled } from "@/lib/features/radiationDguv";
import { prisma } from "@/lib/prisma";

export const serviceTypeGateBlocked = (details: Record<string, unknown>) =>
  new AppError(423, "SERVICE_TYPE_GATE", "Assignee lacks the required qualification for this service type", details);

/** Map request serviceType strings onto gate keys used in ServiceTypeGate. */
export function normalizeServiceTypeGateKey(serviceType: string): "sv" | "konstanz" | "dguv" | null {
  const s = serviceType.trim().toLowerCase();
  if (s === "sv" || s === "expert" || s === "sachverstaendiger" || s.includes("expert")) return "sv";
  if (
    s === "konstanz" ||
    s === "constancy" ||
    s === "radiation" ||
    s.includes("konstanz") ||
    s.includes("constancy")
  ) {
    return "konstanz";
  }
  if (s === "dguv" || s.includes("dguv")) return "dguv";
  return null;
}

function roleSatisfies(
  appRole: string | undefined,
  overridableBy: GateOverridableBy,
): boolean {
  const role = (appRole ?? "").toLowerCase();
  if (overridableBy === "none") return false;
  if (overridableBy === "management") {
    return role === "management" || role === "admin" || role === "gf";
  }
  // service_lead
  return (
    role === "service_lead" ||
    role === "management" ||
    role === "admin" ||
    role === "gf"
  );
}

export async function assertServiceTypeGate(input: {
  tenantId: string;
  organisationId: string;
  serviceType: string;
  assigneeUserId: string;
  serviceRequestId: string;
  overrideReason?: string | null;
  overrideBy?: { userId: string; name: string; appRole: string };
}): Promise<{ overridden: boolean; gateKind: "service_type" | null }> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: { featureFlags: true },
  });
  if (!isRadiationDguvEnabled(tenant?.featureFlags)) {
    return { overridden: false, gateKind: null };
  }

  const gateKey = normalizeServiceTypeGateKey(input.serviceType);
  if (!gateKey) return { overridden: false, gateKind: null };

  let gate = await prisma.serviceTypeGate.findUnique({
    where: {
      organisationId_serviceType: {
        organisationId: input.organisationId,
        serviceType: gateKey,
      },
    },
  });

  // Lazy-create safe defaults on first use
  if (!gate) {
    const defaults: Record<
      string,
      { qualificationCode: string; overridableBy: GateOverridableBy; locked: boolean }
    > = {
      sv: { qualificationCode: "sachverstaendiger", overridableBy: "none", locked: true },
      konstanz: {
        qualificationCode: "fachkunde_strlsch",
        overridableBy: "service_lead",
        locked: false,
      },
      dguv: {
        qualificationCode: "befaehigte_person_elektro",
        overridableBy: "management",
        locked: false,
      },
    };
    const d = defaults[gateKey]!;
    const qual = await prisma.refQualification.findUnique({
      where: { code: d.qualificationCode },
    });
    if (qual) {
      gate = await prisma.serviceTypeGate.create({
        data: {
          organisationId: input.organisationId,
          serviceType: gateKey,
          qualificationCode: d.qualificationCode,
          gate: "block",
          overridableBy: d.overridableBy,
          locked: d.locked,
          setBy: "system",
        },
      });
    }
  }

  if (!gate || gate.gate === "hint") {
    return { overridden: false, gateKind: null };
  }

  const today = new Date();
  const holds = await prisma.personQualification.findMany({
    where: {
      userId: input.assigneeUserId,
      qualificationCode: gate.qualificationCode,
      OR: [{ validUntil: null }, { validUntil: { gte: today } }],
    },
  });

  if (holds.length > 0) {
    return { overridden: false, gateKind: null };
  }

  const reason = input.overrideReason?.trim();
  if (reason && input.overrideBy) {
    if (gate.locked || gate.overridableBy === "none") {
      throw serviceTypeGateBlocked({
        serviceType: gateKey,
        qualificationCode: gate.qualificationCode,
        overridableBy: "none",
        locked: true,
      });
    }
    if (!roleSatisfies(input.overrideBy.appRole, gate.overridableBy)) {
      throw forbidden(
        `Override requires ${gate.overridableBy}; current role cannot override`,
      );
    }
    await prisma.serviceRequest.update({
      where: { id: input.serviceRequestId },
      data: {
        gateOverriddenBy: input.overrideBy.name,
        gateOverriddenByUserId: input.overrideBy.userId,
        gateOverriddenAt: new Date(),
        gateOverrideReason: reason,
        gateKind: "service_type",
      },
    });
    return { overridden: true, gateKind: "service_type" };
  }

  throw serviceTypeGateBlocked({
    serviceType: gateKey,
    qualificationCode: gate.qualificationCode,
    overridableBy: gate.overridableBy,
    locked: gate.locked,
  });
}

/** Soft check — does the person currently satisfy the gate (no override, no throw). */
export async function personPassesServiceTypeGate(input: {
  organisationId: string;
  serviceType: string;
  userId: string;
}): Promise<boolean> {
  const gateKey = normalizeServiceTypeGateKey(input.serviceType);
  if (!gateKey) return true;
  const gate = await prisma.serviceTypeGate.findUnique({
    where: {
      organisationId_serviceType: {
        organisationId: input.organisationId,
        serviceType: gateKey,
      },
    },
  });
  if (!gate || gate.gate === "hint") return true;
  const today = new Date();
  const holds = await prisma.personQualification.count({
    where: {
      userId: input.userId,
      qualificationCode: gate.qualificationCode,
      OR: [{ validUntil: null }, { validUntil: { gte: today } }],
    },
  });
  return holds > 0;
}

export async function listServiceTypeGates(organisationId: string) {
  return prisma.serviceTypeGate.findMany({
    where: { organisationId },
    orderBy: { serviceType: "asc" },
  });
}

export async function updateServiceTypeGate(input: {
  organisationId: string;
  serviceType: string;
  overridableBy: GateOverridableBy;
  setBy: string;
  appRole: string;
}) {
  const role = input.appRole.toLowerCase();
  if (role !== "management" && role !== "admin" && role !== "gf") {
    throw forbidden("Only management may change service-type gates");
  }
  const key = normalizeServiceTypeGateKey(input.serviceType) ?? input.serviceType;
  const existing = await prisma.serviceTypeGate.findUnique({
    where: {
      organisationId_serviceType: {
        organisationId: input.organisationId,
        serviceType: key,
      },
    },
  });
  if (!existing) throw unprocessable("Unknown service-type gate");
  if (existing.locked || key === "sv") {
    throw new AppError(423, "GATE_LOCKED", "SV gate cannot be changed", {
      serviceType: key,
    });
  }
  return prisma.serviceTypeGate.update({
    where: { id: existing.id },
    data: {
      overridableBy: input.overridableBy,
      setBy: input.setBy,
      setAt: new Date(),
    },
  });
}
