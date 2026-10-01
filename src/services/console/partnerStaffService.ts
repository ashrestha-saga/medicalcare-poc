import type { PartnerContext } from "@/interfaces/session";
import type {
  ConsoleStaffInviteInput,
  ConsoleStaffListDTO,
  ConsoleStaffMemberDTO,
} from "@/interfaces/console";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { forbidden, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { isLiveContract } from "@/services/access/partnerAccessService";
import { requirePartnerPermission } from "@/lib/auth/tenantContext";
import { getCachedPartnerConsolePermissions } from "@/services/roles/roleGrantsService";
import { invitationService } from "@/services/users/invitationService";
import { actorFromPartnerOrg } from "@/lib/auth/actorContext";
import { recordAudit } from "@/services/audit/auditService";

function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export const partnerStaffService = {
  async list(ctx: PartnerContext, opts?: { externalOnly?: boolean }): Promise<ConsoleStaffListDTO> {
    const now = new Date();
    const externalOnly = opts?.externalOnly ?? false;
    return runWithoutTenantAsync(async () => {
      const [memberships, contracts] = await Promise.all([
        prisma.orgMembership.findMany({
          where: {
            organisationId: ctx.organisationId,
            isExternal: externalOnly,
            validFrom: { lte: now },
            OR: [{ validTo: null }, { validTo: { gte: now } }],
            user: { active: true, accountKind: "partner" },
          },
          include: {
            user: { select: { id: true, name: true, email: true, jobTitle: true } },
            staffAssignments: { select: { tenantId: true } },
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
        validFrom: isoDate(m.validFrom)!,
        validTo: isoDate(m.validTo),
        isExternal: m.isExternal,
        commissionedFrom: isoDate(m.commissionedFrom),
        commissionedTo: isoDate(m.commissionedTo),
        liabilityUntil: isoDate(m.liabilityUntil),
        liabilitySumEur: m.liabilitySumEur,
        assignedTenantIds:
          m.appRole === "admin" && !m.isExternal
            ? liveTenantIds
            : m.staffAssignments.map((a) => a.tenantId),
      }));

      const perms = getCachedPartnerConsolePermissions(ctx.user.appRole);
      return {
        members,
        clinics,
        canInvite: perms.includes("console:staff:invite") || perms.includes("console:external:manage"),
        canAssign: perms.includes("console:staff:assign"),
      };
    });
  },

  async get(ctx: PartnerContext, membershipId: string): Promise<ConsoleStaffMemberDTO> {
    const list = await this.list(ctx, { externalOnly: false });
    const externals = await this.list(ctx, { externalOnly: true });
    const member =
      list.members.find((m) => m.membershipId === membershipId) ??
      externals.members.find((m) => m.membershipId === membershipId);
    if (!member) throw notFound("Staff member not found.");
    return member;
  },

  async invite(ctx: PartnerContext, input: ConsoleStaffInviteInput, req?: Request | null) {
    requirePartnerPermission(ctx, "console:staff:invite");
    const result = await invitationService.createPartnerInvite(
      ctx,
      { email: input.email, name: input.name, appRole: input.appRole },
      req,
    );

    // After invite redeem the membership is created — default assignment happens on redeem
    // via ensureDefaultAssignments when membership appears. Also backfill when membership exists.
    await this.ensureDefaultAssignmentsForEmail(ctx, input.email);
    return result;
  },

  /** Assign all currently live tenants to a membership (invite default / admin bootstrap). */
  async ensureDefaultAssignmentsForEmail(ctx: PartnerContext, email: string) {
    await runWithoutTenantAsync(async () => {
      const user = await prisma.user.findFirst({
        where: { email: email.trim().toLowerCase(), accountKind: "partner" },
      });
      if (!user) return;
      const membership = await prisma.orgMembership.findFirst({
        where: { userId: user.id, organisationId: ctx.organisationId },
      });
      if (!membership || membership.appRole === "admin") return;

      const now = new Date();
      const contracts = await prisma.serviceContract.findMany({
        where: { organisationId: ctx.organisationId },
      });
      const liveTenantIds = contracts.filter((c) => isLiveContract(c, now)).map((c) => c.tenantId);
      for (const tenantId of liveTenantIds) {
        await prisma.partnerStaffAssignment.upsert({
          where: { membershipId_tenantId: { membershipId: membership.id, tenantId } },
          update: {},
          create: { membershipId: membership.id, tenantId },
        });
      }
    });
  },

  async setAssignments(
    ctx: PartnerContext,
    membershipId: string,
    tenantIds: string[],
  ): Promise<ConsoleStaffMemberDTO> {
    requirePartnerPermission(ctx, "console:staff:assign");
    return runWithoutTenantAsync(async () => {
      const membership = await prisma.orgMembership.findFirst({
        where: { id: membershipId, organisationId: ctx.organisationId },
      });
      if (!membership) throw notFound("Staff member not found.");
      if (membership.appRole === "admin" && !membership.isExternal) {
        throw forbidden();
      }

      const now = new Date();
      const contracts = await prisma.serviceContract.findMany({
        where: { organisationId: ctx.organisationId },
      });
      const liveIds = new Set(
        contracts.filter((c) => isLiveContract(c, now)).map((c) => c.tenantId),
      );
      const next = [...new Set(tenantIds)].filter((id) => liveIds.has(id));

      await prisma.partnerStaffAssignment.deleteMany({ where: { membershipId } });
      if (next.length > 0) {
        await prisma.partnerStaffAssignment.createMany({
          data: next.map((tenantId) => ({ membershipId, tenantId })),
        });
      }

      await recordAudit({
        actor: actorFromPartnerOrg(ctx),
        resource: "org_membership",
        resourceId: membershipId,
        action: "update",
        summary: `Updated tenant assignments (${next.length})`,
        after: { tenantIds: next },
      });

      return this.get(ctx, membershipId);
    });
  },

  /**
   * Assign or revoke a single membership on one live managed tenant
   * (customer detail assign / revoke). Admins cannot be toggled.
   */
  async setTenantAssignment(
    ctx: PartnerContext,
    tenantId: string,
    membershipId: string,
    assigned: boolean,
  ): Promise<void> {
    requirePartnerPermission(ctx, "console:staff:assign");
    await runWithoutTenantAsync(async () => {
      const membership = await prisma.orgMembership.findFirst({
        where: {
          id: membershipId,
          organisationId: ctx.organisationId,
          isExternal: false,
        },
      });
      if (!membership) throw notFound("Staff member not found.");
      if (membership.appRole === "admin") {
        throw forbidden();
      }

      const now = new Date();
      const contract = await prisma.serviceContract.findFirst({
        where: { organisationId: ctx.organisationId, tenantId },
      });
      if (!contract || !isLiveContract(contract, now)) {
        throw forbidden();
      }

      if (assigned) {
        await prisma.partnerStaffAssignment.upsert({
          where: { membershipId_tenantId: { membershipId, tenantId } },
          update: {},
          create: { membershipId, tenantId },
        });
      } else {
        await prisma.partnerStaffAssignment.deleteMany({
          where: { membershipId, tenantId },
        });
      }

      await recordAudit({
        actor: actorFromPartnerOrg(ctx),
        resource: "org_membership",
        resourceId: membershipId,
        action: "update",
        summary: assigned
          ? `Assigned staff to tenant ${tenantId}`
          : `Revoked staff from tenant ${tenantId}`,
        after: { tenantId, assigned },
      });
    });
  },
};
