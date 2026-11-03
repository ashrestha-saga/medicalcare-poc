import type { PartnerContext } from "@/interfaces/session";
import { forbidden } from "@/lib/errors";
import { prismaSystem } from "@/lib/prisma";
import { getCachedPartnerConsolePermissions } from "@/services/roles/roleGrantsService";

export type AccessEvidenceRow = {
  group: "qualification" | "skill" | "equipment" | "commission" | "liability" | "membership";
  title: string;
  evidence: string | null;
  validTo: string | null;
  status: "ok" | "warn" | "stop";
  daysLeft: number | null;
};

function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function statusFor(validTo: Date | null | undefined, today = new Date()): {
  status: "ok" | "warn" | "stop";
  daysLeft: number | null;
} {
  if (!validTo) return { status: "ok", daysLeft: null };
  const ms = startOfDay(validTo).getTime() - startOfDay(today).getTime();
  const days = Math.round(ms / 86400000);
  if (days < 0) return { status: "stop", daysLeft: days };
  if (days <= 90) return { status: "warn", daysLeft: days };
  return { status: "ok", daysLeft: days };
}

/** Mein Zugang — credentials for the signed-in partner user. */
export const inspectAccessService = {
  async forCurrentUser(ctx: PartnerContext): Promise<{
    name: string;
    organisationName: string;
    roleLabel: "technician" | "external";
    subject: string;
    rows: AccessEvidenceRow[];
    warningCount: number;
  }> {
    const granted = getCachedPartnerConsolePermissions(ctx.user.appRole);
    if (!granted.includes("console:nav") && !granted.includes("inspections:view")) {
      throw forbidden();
    }

    const membership = await prismaSystem.orgMembership.findFirst({
      where: {
        organisationId: ctx.organisationId,
        userId: ctx.user.id,
        OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
      },
      include: { organisation: { select: { name: true } } },
      orderBy: { validFrom: "desc" },
    });

    const isExternal = Boolean(membership?.isExternal);
    const rows: AccessEvidenceRow[] = [];

    const quals = await prismaSystem.personQualification.findMany({
      where: { userId: ctx.user.id },
      include: { qualification: { select: { code: true, label: true } } },
    });
    for (const q of quals) {
      const st = statusFor(q.validUntil);
      rows.push({
        group: "qualification",
        title: q.qualification.label || q.qualification.code,
        evidence: q.evidenceRef ?? q.qualification.code,
        validTo: isoDate(q.validUntil),
        ...st,
      });
    }

    const skills = await prismaSystem.personSkill.findMany({
      where: { userId: ctx.user.id },
      include: {
        skill: { select: { label: true } },
        level: { select: { label: true } },
      },
    });
    for (const s of skills) {
      const st = statusFor(s.validUntil);
      rows.push({
        group: "skill",
        title: `${s.skill.label} · ${s.level.label}`,
        evidence: s.evidenceRef ?? null,
        validTo: isoDate(s.validUntil),
        ...st,
      });
    }

    if (membership) {
      const equipment = await prismaSystem.testEquipment.findMany({
        where: {
          organisationId: ctx.organisationId,
          active: true,
          assignedMembershipId: membership.id,
        },
        take: 40,
        orderBy: { label: "asc" },
      });
      for (const eq of equipment) {
        const st = statusFor(eq.calibratedUntil);
        rows.push({
          group: "equipment",
          title: `${eq.label}${eq.serialNumber ? ` · ${eq.serialNumber}` : ""}`,
          evidence: eq.traceabilityRef ?? null,
          validTo: isoDate(eq.calibratedUntil),
          ...st,
        });
      }

      if (isExternal) {
        const stC = statusFor(membership.commissionedTo);
        rows.push({
          group: "commission",
          title: "Commission",
          evidence: membership.commissionedFrom
            ? `from ${isoDate(membership.commissionedFrom)}`
            : null,
          validTo: isoDate(membership.commissionedTo),
          ...stC,
        });
        const stL = statusFor(membership.liabilityUntil);
        rows.push({
          group: "liability",
          title: "Liability cover",
          evidence:
            membership.liabilitySumEur != null ? `€ ${membership.liabilitySumEur}` : null,
          validTo: isoDate(membership.liabilityUntil),
          ...stL,
        });
      }

      if (membership.validTo) {
        const st = statusFor(membership.validTo);
        rows.push({
          group: "membership",
          title: membership.organisation.name,
          evidence: isoDate(membership.validFrom),
          validTo: isoDate(membership.validTo),
          ...st,
        });
      }
    }

    const warningCount = rows.filter((r) => r.status !== "ok").length;

    return {
      name: ctx.user.name,
      organisationName: membership?.organisation.name ?? ctx.user.organisationName,
      roleLabel: isExternal ? "external" : "technician",
      subject: ctx.user.id,
      rows,
      warningCount,
    };
  },
};
