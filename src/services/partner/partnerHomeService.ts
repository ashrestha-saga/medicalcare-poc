import type { PartnerContext, PartnerHomeDTO } from "@/interfaces";
import { parseContractScope } from "@/constants/partnerPermissions";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { isLiveContract } from "@/services/access/partnerAccessService";
import { prisma } from "@/lib/prisma";

function roleWindowOpen(grantedFrom: Date, grantedTo: Date | null, now: Date): boolean {
  if (grantedFrom.getTime() > now.getTime()) return false;
  if (grantedTo != null && grantedTo.getTime() <= now.getTime()) return false;
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
        roles: [],
        people: [],
        clinics: [],
      };
    }

    // Contracts span clinics — bypass SEC-01 tenant stamp/filter.
    const [memberships, contracts, orgRoles] = await runWithoutTenantAsync(() =>
      Promise.all([
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
        prisma.organisationRole.findMany({
          where: { organisationId: orgId },
          orderBy: { role: "asc" },
        }),
      ]),
    );

    return {
      organisationId: organisation.id,
      organisationCode: organisation.code,
      organisationName: organisation.name,
      contact: organisation.contact,
      myAppRole: ctx.user.appRole,
      roles: orgRoles.filter((r) => roleWindowOpen(r.grantedFrom, r.grantedTo, now)).map((r) => r.role),
      people: memberships.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        jobTitle: m.user.jobTitle,
        appRole: m.appRole,
        email: m.user.email,
      })),
      clinics: contracts
        .filter((c) => isLiveContract(c, now))
        .map((c) => ({
          contractId: c.id,
          tenantId: c.tenantId,
          tenantName: c.tenant.name,
          validFrom: c.validFrom.toISOString().slice(0, 10),
          validTo: c.validTo ? c.validTo.toISOString().slice(0, 10) : null,
          scope: parseContractScope(c.scope),
        })),
    };
  },
};
