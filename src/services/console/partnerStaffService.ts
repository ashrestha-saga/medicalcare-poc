import type { PartnerContext } from "@/interfaces/session";
import type {
  ConsoleStaffInviteInput,
  ConsoleStaffListDTO,
  ConsoleStaffMemberDTO,
  ConsoleStaffPatchInput,
  ConsoleStaffQualificationCreateInput,
  ConsoleStaffRefsDTO,
  ConsoleStaffSkillCreateInput,
  ConsoleStaffExpiringItemDTO,
} from "@/interfaces/console";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { conflict, forbidden, notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { isLiveContract } from "@/services/access/partnerAccessService";
import { requirePartnerPermission } from "@/lib/auth/tenantContext";
import { getCachedPartnerConsolePermissions } from "@/services/roles/roleGrantsService";
import { invitationService, type StaffInviteDraft } from "@/services/users/invitationService";
import { actorFromPartnerOrg } from "@/lib/auth/actorContext";
import { recordAudit } from "@/services/audit/auditService";

const EXPIRY_BANNER_DAYS = 90;

function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function parseOptionalDate(v: string | null | undefined): Date | null {
  if (!v || !v.trim()) return null;
  return new Date(`${v.trim()}T00:00:00.000Z`);
}

function inviteRowId(invitationId: string): string {
  return `invite:${invitationId}`;
}

function isInviteRowId(id: string): boolean {
  return id.startsWith("invite:");
}

function invitationIdFromRow(id: string): string {
  return id.slice("invite:".length);
}

async function loadRefs(): Promise<ConsoleStaffRefsDTO> {
  const [qualifications, skills, skillLevels] = await Promise.all([
    prisma.refQualification.findMany({ orderBy: { code: "asc" } }),
    prisma.refSkill.findMany({ orderBy: { label: "asc" } }),
    prisma.refSkillLevel.findMany({ orderBy: { rank: "asc" } }),
  ]);
  return {
    qualifications: qualifications.map((q) => ({ code: q.code, label: q.label })),
    skills: skills.map((s) => ({ code: s.code, label: s.label })),
    skillLevels: skillLevels.map((l) => ({ code: l.code, label: l.label, rank: l.rank })),
  };
}

function collectExpiring(
  members: ConsoleStaffMemberDTO[],
  now: Date,
): ConsoleStaffExpiringItemDTO[] {
  const cutoff = new Date(now.getTime() + EXPIRY_BANNER_DAYS * 24 * 60 * 60 * 1000);
  const items: ConsoleStaffExpiringItemDTO[] = [];
  for (const m of members) {
    if (m.status !== "active") continue;
    for (const q of m.qualifications) {
      if (!q.validUntil) continue;
      const d = new Date(`${q.validUntil}T00:00:00.000Z`);
      if (d >= now && d <= cutoff) {
        items.push({
          membershipId: m.membershipId,
          personName: m.name,
          kind: "qualification",
          label: q.label,
          validUntil: q.validUntil,
        });
      }
    }
    for (const s of m.skills) {
      if (!s.validUntil) continue;
      const d = new Date(`${s.validUntil}T00:00:00.000Z`);
      if (d >= now && d <= cutoff) {
        items.push({
          membershipId: m.membershipId,
          personName: m.name,
          kind: "skill",
          label: s.skillLabel,
          skillLevelCode: s.levelCode,
          validUntil: s.validUntil,
        });
      }
    }
  }
  items.sort((a, b) => a.validUntil.localeCompare(b.validUntil));
  return items;
}

export const partnerStaffService = {
  async list(ctx: PartnerContext, opts?: { externalOnly?: boolean }): Promise<ConsoleStaffListDTO> {
    const now = new Date();
    const externalOnly = opts?.externalOnly ?? false;
    return runWithoutTenantAsync(async () => {
      const [memberships, contracts, pendingInvites, refs] = await Promise.all([
        prisma.orgMembership.findMany({
          where: {
            organisationId: ctx.organisationId,
            isExternal: externalOnly,
            validFrom: { lte: now },
            OR: [{ validTo: null }, { validTo: { gte: now } }],
            user: { active: true, accountKind: "partner" },
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                jobTitle: true,
                qualifications: {
                  include: { qualification: { select: { code: true, label: true } } },
                },
                skills: {
                  include: {
                    skill: { select: { code: true, label: true } },
                    level: { select: { code: true, label: true } },
                  },
                },
              },
            },
            staffAssignments: { select: { tenantId: true } },
          },
          orderBy: [{ appRole: "asc" }, { user: { name: "asc" } }],
        }),
        prisma.serviceContract.findMany({
          where: { organisationId: ctx.organisationId },
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                code: true,
                sites: { take: 1, select: { city: true }, orderBy: { name: "asc" } },
              },
            },
          },
          orderBy: { validFrom: "desc" },
        }),
        externalOnly
          ? Promise.resolve([])
          : prisma.userInvitation.findMany({
              where: {
                organisationId: ctx.organisationId,
                acceptedAt: null,
                expiresAt: { gt: now },
                appRole: { not: null },
              },
              orderBy: { createdAt: "desc" },
            }),
        loadRefs(),
      ]);

      const clinics = contracts.map((c) => ({
        tenantId: c.tenantId,
        tenantName: c.tenant.name,
        tenantCode: c.tenant.code,
        live: isLiveContract(c, now),
        city: c.tenant.sites[0]?.city ?? null,
      }));
      const liveTenantIds = clinics.filter((c) => c.live).map((c) => c.tenantId);
      const clinicNameById = new Map(clinics.map((c) => [c.tenantId, c.tenantName]));

      const activeMembers: ConsoleStaffMemberDTO[] = memberships.map((m) => {
        const assignedTenantIds =
          m.appRole === "admin" && !m.isExternal
            ? liveTenantIds
            : m.staffAssignments.map((a) => a.tenantId);
        return {
          membershipId: m.id,
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
          jobTitle: m.user.jobTitle,
          appRole: String(m.appRole),
          validFrom: isoDate(m.validFrom),
          validTo: isoDate(m.validTo),
          isExternal: m.isExternal,
          commissionedFrom: isoDate(m.commissionedFrom),
          commissionedTo: isoDate(m.commissionedTo),
          liabilityUntil: isoDate(m.liabilityUntil),
          liabilitySumEur: m.liabilitySumEur,
          assignedTenantIds,
          status: "active" as const,
          dispatchOrigin: m.dispatchOrigin,
          originPostalCode: m.originPostalCode,
          originCity: m.originCity,
          radiusKm: m.radiusKm,
          qualifications: m.user.qualifications.map((q) => ({
            id: q.id,
            code: q.qualification.code,
            label: q.qualification.label,
            validUntil: isoDate(q.validUntil),
            evidenceRef: q.evidenceRef,
          })),
          skills: m.user.skills.map((s) => ({
            id: s.id,
            skillCode: s.skill.code,
            skillLabel: s.skill.label,
            levelCode: s.level.code,
            levelLabel: s.level.label,
            validUntil: isoDate(s.validUntil),
            evidenceRef: s.evidenceRef,
          })),
          assignedClinicNames: assignedTenantIds
            .map((id) => clinicNameById.get(id))
            .filter((n): n is string => Boolean(n)),
        };
      });

      // Exclude invites that are for external inspectors (permissions.__partnerExternal).
      const invitedMembers: ConsoleStaffMemberDTO[] = pendingInvites
        .filter((inv) => {
          const perms = inv.permissions;
          if (!perms || typeof perms !== "object" || Array.isArray(perms)) return true;
          return !("__partnerExternal" in (perms as object));
        })
        .map((inv) => {
          const draft =
            inv.permissions &&
            typeof inv.permissions === "object" &&
            !Array.isArray(inv.permissions) &&
            "__staffDraft" in (inv.permissions as object)
              ? ((inv.permissions as { __staffDraft?: StaffInviteDraft }).__staffDraft ?? null)
              : null;
          return {
            membershipId: inviteRowId(inv.id),
            userId: null,
            name: inv.name?.trim() || inv.email,
            email: inv.email,
            jobTitle: draft?.jobTitle ?? null,
            appRole: String(inv.appRole ?? "inspector"),
            validFrom: draft?.validFrom ?? null,
            validTo: null,
            isExternal: false,
            commissionedFrom: null,
            commissionedTo: null,
            liabilityUntil: null,
            liabilitySumEur: null,
            assignedTenantIds: [],
            status: "invited" as const,
            dispatchOrigin: draft?.dispatchOrigin ?? null,
            originPostalCode: draft?.originPostalCode ?? null,
            originCity: draft?.originCity ?? null,
            radiusKm: draft?.radiusKm ?? null,
            qualifications: [],
            skills: [],
            assignedClinicNames: [],
            invitationExpiresAt: inv.expiresAt.toISOString(),
          };
        });

      const members = [...activeMembers, ...invitedMembers];
      const perms = getCachedPartnerConsolePermissions(ctx.user.appRole);
      return {
        members,
        clinics,
        canInvite: perms.includes("console:staff:invite") || perms.includes("console:external:manage"),
        canAssign: perms.includes("console:staff:assign"),
        expiringSoon: collectExpiring(activeMembers, now),
        refs,
      };
    });
  },

  async get(ctx: PartnerContext, membershipId: string): Promise<ConsoleStaffMemberDTO> {
    if (isInviteRowId(membershipId)) {
      const list = await this.list(ctx, { externalOnly: false });
      const member = list.members.find((m) => m.membershipId === membershipId);
      if (!member) throw notFound("Invitation not found.");
      return member;
    }
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
    const draft: StaffInviteDraft = {
      jobTitle: input.jobTitle?.trim() || null,
      validFrom: input.validFrom?.trim() || null,
      dispatchOrigin: input.dispatchOrigin ?? "organisation",
      originPostalCode: input.originPostalCode?.trim() || null,
      originCity: input.originCity?.trim() || null,
      radiusKm: input.radiusKm ?? null,
      skills: (input.skills ?? []).map((s) => ({
        skillCode: s.skillCode,
        levelCode: s.levelCode,
        validUntil: s.validUntil?.trim() || null,
        evidenceRef: s.evidenceRef?.trim() || null,
      })),
    };

    const result = await invitationService.createPartnerInvite(
      ctx,
      {
        email: input.email,
        name: input.name,
        appRole: input.appRole,
        staffDraft: draft,
      },
      req,
    );

    return result;
  },

  async update(
    ctx: PartnerContext,
    membershipId: string,
    input: ConsoleStaffPatchInput,
  ): Promise<ConsoleStaffMemberDTO> {
    requirePartnerPermission(ctx, "console:staff:invite");
    if (isInviteRowId(membershipId)) {
      throw unprocessable("Pending invites cannot be edited until accepted.");
    }
    return runWithoutTenantAsync(async () => {
      const membership = await prisma.orgMembership.findFirst({
        where: { id: membershipId, organisationId: ctx.organisationId },
        include: { user: true },
      });
      if (!membership) throw notFound("Staff member not found.");

      await prisma.$transaction(async (tx) => {
        if (input.name !== undefined || input.jobTitle !== undefined) {
          await tx.user.update({
            where: { id: membership.userId },
            data: {
              ...(input.name !== undefined ? { name: input.name.trim() } : {}),
              ...(input.jobTitle !== undefined
                ? { jobTitle: input.jobTitle?.trim() || null }
                : {}),
            },
          });
        }
        await tx.orgMembership.update({
          where: { id: membershipId },
          data: {
            ...(input.appRole !== undefined ? { appRole: input.appRole } : {}),
            ...(input.validFrom !== undefined
              ? { validFrom: new Date(`${input.validFrom}T00:00:00.000Z`) }
              : {}),
            ...(input.dispatchOrigin !== undefined
              ? { dispatchOrigin: input.dispatchOrigin }
              : {}),
            ...(input.originPostalCode !== undefined
              ? { originPostalCode: input.originPostalCode?.trim() || null }
              : {}),
            ...(input.originCity !== undefined
              ? { originCity: input.originCity?.trim() || null }
              : {}),
            ...(input.radiusKm !== undefined ? { radiusKm: input.radiusKm } : {}),
          },
        });
      });

      await recordAudit({
        actor: actorFromPartnerOrg(ctx),
        resource: "org_membership",
        resourceId: membershipId,
        action: "update",
        summary: `Updated staff profile ${membership.user.email}`,
        after: input as object,
      });

      return this.get(ctx, membershipId);
    });
  },

  async addSkill(
    ctx: PartnerContext,
    membershipId: string,
    input: ConsoleStaffSkillCreateInput,
  ): Promise<ConsoleStaffMemberDTO> {
    requirePartnerPermission(ctx, "console:staff:invite");
    if (isInviteRowId(membershipId)) {
      throw unprocessable("Pending invites cannot hold skills until accepted.");
    }
    return runWithoutTenantAsync(async () => {
      const membership = await prisma.orgMembership.findFirst({
        where: { id: membershipId, organisationId: ctx.organisationId },
      });
      if (!membership) throw notFound("Staff member not found.");

      const existing = await prisma.personSkill.findUnique({
        where: {
          userId_skillCode: { userId: membership.userId, skillCode: input.skillCode },
        },
      });
      if (existing) throw conflict("Skill already recorded for this person.");

      await prisma.personSkill.create({
        data: {
          userId: membership.userId,
          skillCode: input.skillCode,
          levelCode: input.levelCode,
          validUntil: parseOptionalDate(input.validUntil),
          evidenceRef: input.evidenceRef?.trim() || null,
          recordedBy: ctx.user.id,
        },
      });
      return this.get(ctx, membershipId);
    });
  },

  async removeSkill(
    ctx: PartnerContext,
    membershipId: string,
    skillId: string,
  ): Promise<ConsoleStaffMemberDTO> {
    requirePartnerPermission(ctx, "console:staff:invite");
    if (isInviteRowId(membershipId)) {
      throw unprocessable("Pending invites cannot be edited.");
    }
    return runWithoutTenantAsync(async () => {
      const membership = await prisma.orgMembership.findFirst({
        where: { id: membershipId, organisationId: ctx.organisationId },
      });
      if (!membership) throw notFound("Staff member not found.");
      const skill = await prisma.personSkill.findFirst({
        where: { id: skillId, userId: membership.userId },
      });
      if (!skill) throw notFound("Skill not found.");
      await prisma.personSkill.delete({ where: { id: skillId } });
      return this.get(ctx, membershipId);
    });
  },

  async addQualification(
    ctx: PartnerContext,
    membershipId: string,
    input: ConsoleStaffQualificationCreateInput,
  ): Promise<ConsoleStaffMemberDTO> {
    requirePartnerPermission(ctx, "console:staff:invite");
    if (isInviteRowId(membershipId)) {
      throw unprocessable("Pending invites cannot hold qualifications until accepted.");
    }
    return runWithoutTenantAsync(async () => {
      const membership = await prisma.orgMembership.findFirst({
        where: { id: membershipId, organisationId: ctx.organisationId },
      });
      if (!membership) throw notFound("Staff member not found.");

      const existing = await prisma.personQualification.findUnique({
        where: {
          userId_qualificationCode: {
            userId: membership.userId,
            qualificationCode: input.qualificationCode,
          },
        },
      });
      if (existing) throw conflict("Qualification already recorded for this person.");

      await prisma.personQualification.create({
        data: {
          userId: membership.userId,
          qualificationCode: input.qualificationCode,
          validUntil: parseOptionalDate(input.validUntil),
          evidenceRef: input.evidenceRef?.trim() || null,
          recordedBy: ctx.user.id,
        },
      });
      return this.get(ctx, membershipId);
    });
  },

  async removeQualification(
    ctx: PartnerContext,
    membershipId: string,
    qualificationId: string,
  ): Promise<ConsoleStaffMemberDTO> {
    requirePartnerPermission(ctx, "console:staff:invite");
    if (isInviteRowId(membershipId)) {
      throw unprocessable("Pending invites cannot be edited.");
    }
    return runWithoutTenantAsync(async () => {
      const membership = await prisma.orgMembership.findFirst({
        where: { id: membershipId, organisationId: ctx.organisationId },
      });
      if (!membership) throw notFound("Staff member not found.");
      const row = await prisma.personQualification.findFirst({
        where: { id: qualificationId, userId: membership.userId },
      });
      if (!row) throw notFound("Qualification not found.");
      await prisma.personQualification.delete({ where: { id: qualificationId } });
      return this.get(ctx, membershipId);
    });
  },

  async setAssignments(
    ctx: PartnerContext,
    membershipId: string,
    tenantIds: string[],
  ): Promise<ConsoleStaffMemberDTO> {
    requirePartnerPermission(ctx, "console:staff:assign");
    if (isInviteRowId(membershipId)) {
      throw unprocessable("Pending invites cannot be assigned tenants until accepted.");
    }
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

export { inviteRowId, isInviteRowId, invitationIdFromRow };
