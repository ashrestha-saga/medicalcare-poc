import type { PartnerContext } from "@/interfaces/session";
import type {
  ConsoleStaffInviteInput,
  ConsoleStaffListDTO,
  ConsoleStaffMemberDTO,
} from "@/interfaces/console";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { prisma } from "@/lib/prisma";
import { isLiveContract } from "@/services/access/partnerAccessService";
import { requirePartnerPermission } from "@/lib/auth/tenantContext";
import { getCachedPartnerConsolePermissions } from "@/services/roles/roleGrantsService";
import { invitationService } from "@/services/users/invitationService";

/** Soft assignment store: membershipId → tenantIds (JSON blob on Organisation.contact unused — use Audit-free meta table via membership note).
 * For this wave we treat all live contracts as visible to every active member;
 * admins can invite; assignment UI stores preferred tenants in local persistence later.
 * Persist assignments on OrgMembership via a new optional field is deferred — use all live tenants for everyone.
 */
export const partnerStaffService = {
  async list(ctx: PartnerContext): Promise<ConsoleStaffListDTO> {
    const now = new Date();
    return runWithoutTenantAsync(async () => {
      const [memberships, contracts] = await Promise.all([
        prisma.orgMembership.findMany({
          where: {
            organisationId: ctx.organisationId,
            validFrom: { lte: now },
            OR: [{ validTo: null }, { validTo: { gte: now } }],
            user: { active: true, accountKind: "partner" },
          },
          include: {
            user: { select: { id: true, name: true, email: true, jobTitle: true } },
          },
          orderBy: [{ appRole: "asc" }, { user: { name: "asc" } }],
        }),
        prisma.serviceContract.findMany({
          where: { organisationId: ctx.organisationId },
          include: { tenant: { select: { id: true, name: true, code: true } } },
          orderBy: { validFrom: "desc" },
        }),
      ]);

      const clinics = contracts.map((c) => ({
        tenantId: c.tenantId,
        tenantName: c.tenant.name,
        tenantCode: c.tenant.code,
        live: isLiveContract(c, now),
      }));
      const liveTenantIds = clinics.filter((c) => c.live).map((c) => c.tenantId);

      const members: ConsoleStaffMemberDTO[] = memberships.map((m) => ({
        membershipId: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        jobTitle: m.user.jobTitle,
        appRole: String(m.appRole),
        validFrom: m.validFrom.toISOString().slice(0, 10),
        validTo: m.validTo ? m.validTo.toISOString().slice(0, 10) : null,
        assignedTenantIds: liveTenantIds,
      }));

      return {
        members,
        clinics,
        canInvite: getCachedPartnerConsolePermissions(ctx.user.appRole).includes("console:staff:invite"),
      };
    });
  },

  async invite(ctx: PartnerContext, input: ConsoleStaffInviteInput, req?: Request | null) {
    requirePartnerPermission(ctx, "console:staff:invite");
    return invitationService.createPartnerInvite(
      ctx,
      { email: input.email, name: input.name, appRole: input.appRole },
      req,
    );
  },
};
