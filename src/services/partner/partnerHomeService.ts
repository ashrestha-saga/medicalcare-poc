import type { PartnerContext, PartnerHomeDTO } from "@/interfaces";
import { prisma } from "@/lib/prisma";

function parseScope(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

function isActiveWindow(validFrom: Date, validTo: Date | null, now: Date): boolean {
  if (validFrom.getTime() > now.getTime()) return false;
  if (validTo != null && validTo.getTime() < now.getTime()) return false;
  return true;
}

export const partnerHomeService = {
  async getHome(ctx: PartnerContext): Promise<PartnerHomeDTO> {
    const now = new Date();
    const orgId = ctx.organisationId;

    const organisation = await prisma.organisation.findFirst({
      where: { id: orgId },
    });
    if (!organisation) {
      return {
        organisationId: orgId,
        organisationCode: "",
        organisationName: ctx.user.organisationName,
        contact: null,
        myAppRole: ctx.user.appRole,
        people: [],
        clinics: [],
      };
    }

    const [memberships, contracts] = await Promise.all([
      prisma.orgMembership.findMany({
        where: {
          organisationId: orgId,
          validFrom: { lte: now },
          OR: [{ validTo: null }, { validTo: { gte: now } }],
          user: { active: true, accountKind: "partner" },
        },
        include: {
          user: { select: { id: true, name: true, email: true, jobTitle: true } },
        },
        orderBy: { appRole: "asc" },
      }),
      prisma.serviceContract.findMany({
        where: { organisationId: orgId },
        include: { tenant: { select: { id: true, name: true } } },
        orderBy: { validFrom: "desc" },
      }),
    ]);

    return {
      organisationId: organisation.id,
      organisationCode: organisation.code,
      organisationName: organisation.name,
      contact: organisation.contact,
      myAppRole: ctx.user.appRole,
      people: memberships.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        jobTitle: m.user.jobTitle,
        appRole: m.appRole,
        email: m.user.email,
      })),
      clinics: contracts
        .filter((c) => isActiveWindow(c.validFrom, c.validTo, now))
        .map((c) => ({
          contractId: c.id,
          tenantId: c.tenantId,
          tenantName: c.tenant.name,
          validFrom: c.validFrom.toISOString().slice(0, 10),
          validTo: c.validTo ? c.validTo.toISOString().slice(0, 10) : null,
          scope: parseScope(c.scope),
        })),
    };
  },
};
