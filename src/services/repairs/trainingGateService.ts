import type { PartnerContext, ActingContext } from "@/interfaces";
import { AppError, notFound, unprocessable } from "@/lib/errors";
import { requirePartnerPermission } from "@/lib/auth/tenantContext";
import { prisma } from "@/lib/prisma";
import { actorFromPartnerOrg } from "@/lib/auth/actorContext";
import { recordAudit } from "@/services/audit/auditService";
import { REPAIR_SERVICE_TYPE } from "@/constants/repairs";

export const trainingGateBlocked = (manufacturer: string) =>
  new AppError(423, "TRAINING_GATE", `Manufacturer training required for ${manufacturer}`, {
    manufacturer,
  });

export function manufacturerSlug(manufacturer: string): string {
  return manufacturer
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Exact OEM repair qual code for a manufacturer (e.g. Medisens → repair_medisens). */
export function repairQualificationCodeForManufacturer(manufacturer: string): string {
  return `repair_${manufacturerSlug(manufacturer)}`;
}

/**
 * True when the person holds manufacturer-specific repair training.
 * Exact code match, or qualification label that names the manufacturer.
 * Does NOT accept an unrelated repair_* qual for a different OEM.
 */
export function isTrainedForManufacturer(input: {
  manufacturer: string;
  holds: { qualificationCode: string; label?: string | null }[];
}): boolean {
  const manufacturer = input.manufacturer.trim();
  if (!manufacturer) return true;
  const slugCode = repairQualificationCodeForManufacturer(manufacturer);
  const mLower = manufacturer.toLowerCase();
  return input.holds.some(
    (h) =>
      h.qualificationCode === slugCode ||
      Boolean(h.label?.toLowerCase().includes(mLower)),
  );
}

/** List / upsert gates for a service org (E79). */
export async function listTrainingGates(ctx: PartnerContext) {
  requirePartnerPermission(ctx, "console:staff:view");
  return prisma.manufacturerTrainingGate.findMany({
    where: { organisationId: ctx.organisationId },
    orderBy: { manufacturer: "asc" },
  });
}

export async function setTrainingGate(
  ctx: PartnerContext,
  input: { manufacturer: string; gate: "hint" | "block" },
) {
  requirePartnerPermission(ctx, "console:staff:invite");
  const role = String(ctx.user.appRole);
  if (role !== "service_lead" && role !== "management" && role !== "admin") {
    throw new AppError(403, "forbidden", "Only Serviceleitung/GF may change training gates");
  }
  const manufacturer = input.manufacturer.trim();
  if (!manufacturer) throw unprocessable("manufacturer required");

  const row = await prisma.manufacturerTrainingGate.upsert({
    where: {
      organisationId_manufacturer: {
        organisationId: ctx.organisationId,
        manufacturer,
      },
    },
    create: {
      organisationId: ctx.organisationId,
      manufacturer,
      gate: input.gate,
      setBy: ctx.user.name,
    },
    update: { gate: input.gate, setBy: ctx.user.name, setAt: new Date() },
  });

  await recordAudit({
    actor: actorFromPartnerOrg(ctx),
    resource: "ManufacturerTrainingGate",
    resourceId: row.id,
    action: "set",
    summary: `${manufacturer}: ${input.gate}`,
  });

  return row;
}

async function resolveTrainingGateState(input: {
  organisationId: string;
  manufacturer: string;
  assigneeUserId: string;
  serviceType: string;
}): Promise<"ok" | "hint" | "block"> {
  if (input.serviceType !== REPAIR_SERVICE_TYPE && input.serviceType !== "REPAIR") {
    return "ok";
  }
  const manufacturer = input.manufacturer.trim();
  if (!manufacturer) return "ok";

  const gate = await prisma.manufacturerTrainingGate.findUnique({
    where: {
      organisationId_manufacturer: {
        organisationId: input.organisationId,
        manufacturer,
      },
    },
  });
  const mode = gate?.gate ?? "hint";
  const slugCode = repairQualificationCodeForManufacturer(manufacturer);

  const holds = await prisma.personQualification.findMany({
    where: {
      userId: input.assigneeUserId,
      OR: [
        { qualificationCode: slugCode },
        { qualificationCode: { startsWith: "repair_" } },
      ],
    },
    include: { qualification: { select: { label: true } } },
  });

  const trained = isTrainedForManufacturer({
    manufacturer,
    holds: holds.map((h) => ({
      qualificationCode: h.qualificationCode,
      label: h.qualification.label,
    })),
  });

  if (trained) return "ok";
  if (mode === "hint") return "hint";
  return "block";
}

/**
 * Create-order form (no override) — block untrained assignee when gate is Sperre.
 */
export async function assertTrainingGateOnCreate(input: {
  organisationId: string;
  manufacturer: string;
  assigneeUserId: string;
  serviceType: string;
}): Promise<"ok" | "hint"> {
  const state = await resolveTrainingGateState(input);
  if (state === "block") throw trainingGateBlocked(input.manufacturer);
  return state;
}

/**
 * R20 — assert assignee may take a repair for this manufacturer.
 */
export async function assertTrainingGate(input: {
  organisationId: string;
  manufacturer: string;
  assigneeUserId: string;
  serviceRequestId: string;
  serviceType: string;
  overrideReason?: string | null;
  overrideBy?: { userId: string; name: string; appRole: string };
}): Promise<"ok" | "hint" | "overridden"> {
  const state = await resolveTrainingGateState(input);
  if (state === "ok" || state === "hint") return state;

  const existing = await prisma.serviceRequest.findFirst({
    where: { id: input.serviceRequestId },
    select: { gateOverriddenAt: true },
  });
  if (existing?.gateOverriddenAt) return "overridden";

  if (input.overrideReason?.trim() && input.overrideBy) {
    const role = input.overrideBy.appRole;
    if (role !== "service_lead" && role !== "management" && role !== "admin") {
      throw new AppError(403, "forbidden", "Override requires Serviceleitung/GF");
    }
    await prisma.serviceRequest.update({
      where: { id: input.serviceRequestId },
      data: {
        gateOverriddenBy: input.overrideBy.name,
        gateOverriddenByUserId: input.overrideBy.userId,
        gateOverriddenAt: new Date(),
        gateOverrideReason: input.overrideReason.trim(),
      },
    });
    return "overridden";
  }

  throw trainingGateBlocked(input.manufacturer);
}

/** Used at K-REP start. */
export async function assertCanStartRepairRun(ctx: ActingContext, serviceRequestId: string) {
  const sr = await prisma.serviceRequest.findFirst({
    where: { id: serviceRequestId, tenantId: ctx.tenantId },
  });
  if (!sr) throw notFound("Service request not found");
  if (sr.serviceType !== REPAIR_SERVICE_TYPE && sr.serviceType !== "REPAIR") return;

  const device = await prisma.deviceInstance.findFirst({
    where: { id: sr.subjectId },
    select: { model: { select: { manufacturer: true } } },
  });
  const manufacturer = device?.model?.manufacturer ?? "";
  const orgId = ctx.user.accountKind === "partner" ? ctx.user.organisationId : null;
  if (!orgId || !sr.assigneeUserId) return;

  await assertTrainingGate({
    organisationId: orgId,
    manufacturer,
    assigneeUserId: sr.assigneeUserId,
    serviceRequestId: sr.id,
    serviceType: sr.serviceType,
  });
}
