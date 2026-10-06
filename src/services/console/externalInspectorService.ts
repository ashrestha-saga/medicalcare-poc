import type { PartnerContext } from "@/interfaces/session";
import type {
  ConsoleExternalListDTO,
  ConsoleExternalNotDeployableDTO,
  ConsoleStaffMemberDTO,
  ConsoleStaffRefsDTO,
  ConsoleStaffSkillCreateInput,
  ConsoleStaffQualificationCreateInput,
} from "@/interfaces/console";
import type {
  ConsoleExternalInviteParsed,
  ConsoleExternalUpdateParsed,
} from "@/schemas/console";
import { actorFromPartnerOrg } from "@/lib/auth/actorContext";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { conflict, notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requirePartnerPermission } from "@/lib/auth/tenantContext";
import {
  invitationService,
  type StaffInviteDraft,
} from "@/services/users/invitationService";
import { recordAudit } from "@/services/audit/auditService";
import { isInviteRowId } from "@/services/console/partnerStaffService";
import { getCachedPartnerConsolePermissions } from "@/services/roles/roleGrantsService";

function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function parseDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function parseOptionalDate(v: string | null | undefined): Date | null {
  if (!v || !v.trim()) return null;
  return new Date(`${v.trim()}T00:00:00.000Z`);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function inviteRowId(invitationId: string): string {
  return `invite:${invitationId}`;
}

function deployableStatus(args: {
  status: "active" | "invited";
  commissionedTo: string | null;
  liabilityUntil: string | null;
}): { deployable: boolean; reason: string | null } {
  if (args.status === "invited") {
    return { deployable: false, reason: "Invitation not yet accepted" };
  }
  const today = todayIso();
  if (args.commissionedTo && args.commissionedTo < today) {
    return { deployable: false, reason: `Commission ended on ${args.commissionedTo}` };
  }
  if (args.liabilityUntil && args.liabilityUntil < today) {
    return { deployable: false, reason: `Liability cover ended on ${args.liabilityUntil}` };
  }
  if (!args.commissionedTo || !args.liabilityUntil) {
    return { deployable: false, reason: "Commission or liability cover incomplete" };
  }
  return { deployable: true, reason: null };
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

async function requireExternalMembership(ctx: PartnerContext, membershipId: string) {
  if (isInviteRowId(membershipId)) {
    throw unprocessable("Pending invites cannot be edited until accepted.");
  }
  const membership = await prisma.orgMembership.findFirst({
    where: { id: membershipId, organisationId: ctx.organisationId, isExternal: true },
  });
  if (!membership) throw notFound("External inspector not found.");
  return membership;
}

export const externalInspectorService = {
  async list(ctx: PartnerContext): Promise<ConsoleExternalListDTO> {
    requirePartnerPermission(ctx, "console:external:view");
    const now = new Date();
    return runWithoutTenantAsync(async () => {
      const [memberships, pendingInvites, employerOrgs, refs] = await Promise.all([
        prisma.orgMembership.findMany({
          where: {
            organisationId: ctx.organisationId,
            isExternal: true,
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
            employerOrganisation: { select: { id: true, name: true, code: true } },
          },
          orderBy: [{ user: { name: "asc" } }],
        }),
        prisma.userInvitation.findMany({
          where: {
            organisationId: ctx.organisationId,
            acceptedAt: null,
            expiresAt: { gt: now },
            appRole: { not: null },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.organisation.findMany({
          where: {
            NOT: { id: ctx.organisationId },
            roles: { some: { role: "inspection_partner" } },
            OR: [{ activeTo: null }, { activeTo: { gte: now } }],
          },
          select: { id: true, name: true, code: true },
          orderBy: { name: "asc" },
        }),
        loadRefs(),
      ]);

      const employerById = new Map(employerOrgs.map((o) => [o.id, o]));

      const activeMembers: ConsoleStaffMemberDTO[] = memberships.map((m) => {
        const commissionedTo = isoDate(m.commissionedTo);
        const liabilityUntil = isoDate(m.liabilityUntil);
        const dep = deployableStatus({
          status: "active",
          commissionedTo,
          liabilityUntil,
        });
        return {
          membershipId: m.id,
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
          jobTitle: m.user.jobTitle,
          appRole: String(m.appRole),
          validFrom: isoDate(m.validFrom),
          validTo: isoDate(m.validTo),
          isExternal: true,
          commissionedFrom: isoDate(m.commissionedFrom),
          commissionedTo,
          liabilityUntil,
          liabilitySumEur: m.liabilitySumEur,
          assignedTenantIds: [],
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
          assignedClinicNames: [],
          employerOrganisationId: m.employerOrganisationId,
          employerName: m.employerOrganisation?.name ?? null,
          employerCode: m.employerOrganisation?.code ?? null,
          deployable: dep.deployable,
          notDeployableReason: dep.reason,
        };
      });

      const invitedMembers: ConsoleStaffMemberDTO[] = pendingInvites
        .filter((inv) => {
          const perms = inv.permissions;
          if (!perms || typeof perms !== "object" || Array.isArray(perms)) return false;
          return "__partnerExternal" in (perms as object);
        })
        .map((inv) => {
          const perms = inv.permissions as {
            __partnerExternal?: {
              commissionedFrom: string;
              commissionedTo: string;
              liabilityUntil: string;
              liabilitySumEur?: number | null;
              employerOrganisationId?: string | null;
            };
            __staffDraft?: StaffInviteDraft;
          };
          const ext = perms.__partnerExternal;
          const draft = perms.__staffDraft;
          const employerId =
            ext?.employerOrganisationId?.trim() || draft?.employerOrganisationId?.trim() || null;
          const employer = employerId ? employerById.get(employerId) : null;
          const commissionedTo = ext?.commissionedTo ?? null;
          const liabilityUntil = ext?.liabilityUntil ?? null;
          const dep = deployableStatus({
            status: "invited",
            commissionedTo,
            liabilityUntil,
          });
          return {
            membershipId: inviteRowId(inv.id),
            userId: null,
            name: inv.name?.trim() || inv.email,
            email: inv.email,
            jobTitle: null,
            appRole: String(inv.appRole ?? "inspector"),
            validFrom: ext?.commissionedFrom ?? null,
            validTo: null,
            isExternal: true,
            commissionedFrom: ext?.commissionedFrom ?? null,
            commissionedTo,
            liabilityUntil,
            liabilitySumEur: ext?.liabilitySumEur ?? null,
            assignedTenantIds: [],
            status: "invited" as const,
            dispatchOrigin: "organisation" as const,
            originPostalCode: draft?.originPostalCode ?? null,
            originCity: draft?.originCity ?? null,
            radiusKm: draft?.radiusKm ?? null,
            qualifications: [],
            skills: [],
            assignedClinicNames: [],
            invitationExpiresAt: inv.expiresAt.toISOString(),
            employerOrganisationId: employerId,
            employerName: employer?.name ?? null,
            employerCode: employer?.code ?? null,
            deployable: dep.deployable,
            notDeployableReason: dep.reason,
          };
        });

      const members = [...activeMembers, ...invitedMembers];
      const notDeployable: ConsoleExternalNotDeployableDTO[] = members
        .filter((m) => !m.deployable && m.status === "active")
        .map((m) => ({
          membershipId: m.membershipId,
          personName: m.name,
          reason: m.notDeployableReason ?? "Not deployable",
        }));

      const perms = getCachedPartnerConsolePermissions(ctx.user.appRole);
      return {
        members,
        notDeployable,
        employerOptions: employerOrgs.map((o) => ({
          id: o.id,
          name: o.name,
          code: o.code,
        })),
        refs,
        canManage: perms.includes("console:external:manage"),
      };
    });
  },

  async get(ctx: PartnerContext, membershipId: string): Promise<ConsoleStaffMemberDTO> {
    requirePartnerPermission(ctx, "console:external:view");
    const list = await this.list(ctx);
    const member = list.members.find((m) => m.membershipId === membershipId);
    if (!member || !member.isExternal) throw notFound("External inspector not found.");
    return member;
  },

  async invite(ctx: PartnerContext, input: ConsoleExternalInviteParsed, req?: Request | null) {
    requirePartnerPermission(ctx, "console:external:manage");
    if (parseDate(input.commissionedTo) < parseDate(input.commissionedFrom)) {
      throw unprocessable("Commission end must be on or after start.", { field: "commissionedTo" });
    }

    const employer = await runWithoutTenantAsync(() =>
      prisma.organisation.findFirst({
        where: {
          id: input.employerOrganisationId,
          NOT: { id: ctx.organisationId },
          roles: { some: { role: "inspection_partner" } },
        },
      }),
    );
    if (!employer) {
      throw unprocessable("Employer organisation not found.", {
        field: "employerOrganisationId",
      });
    }

    const draft: StaffInviteDraft = {
      dispatchOrigin: "organisation",
      originPostalCode: input.originPostalCode?.trim() || null,
      originCity: input.originCity?.trim() || null,
      radiusKm: input.radiusKm ?? null,
      employerOrganisationId: input.employerOrganisationId,
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
        appRole: "inspector",
        external: {
          commissionedFrom: input.commissionedFrom,
          commissionedTo: input.commissionedTo,
          liabilityUntil: input.liabilityUntil,
          liabilitySumEur: input.liabilitySumEur,
          employerOrganisationId: input.employerOrganisationId,
        },
        staffDraft: draft,
      },
      req,
    );

    await recordAudit({
      actor: actorFromPartnerOrg(ctx),
      resource: "org_membership",
      resourceId: input.email,
      action: "create",
      summary: `Invited external inspector ${input.email}`,
      after: {
        commissionedFrom: input.commissionedFrom,
        commissionedTo: input.commissionedTo,
        liabilityUntil: input.liabilityUntil,
        employerOrganisationId: input.employerOrganisationId,
      },
    });

    return result;
  },

  async update(
    ctx: PartnerContext,
    membershipId: string,
    input: ConsoleExternalUpdateParsed,
  ): Promise<ConsoleStaffMemberDTO> {
    requirePartnerPermission(ctx, "console:external:manage");
    return runWithoutTenantAsync(async () => {
      const membership = await requireExternalMembership(ctx, membershipId);

      if (input.employerOrganisationId) {
        const employer = await prisma.organisation.findFirst({
          where: {
            id: input.employerOrganisationId,
            NOT: { id: ctx.organisationId },
            roles: { some: { role: "inspection_partner" } },
          },
        });
        if (!employer) {
          throw unprocessable("Employer organisation not found.", {
            field: "employerOrganisationId",
          });
        }
      }

      await prisma.$transaction(async (tx) => {
        if (input.name !== undefined) {
          await tx.user.update({
            where: { id: membership.userId },
            data: { name: input.name.trim() },
          });
        }
        await tx.orgMembership.update({
          where: { id: membershipId },
          data: {
            ...(input.commissionedFrom
              ? { commissionedFrom: parseDate(input.commissionedFrom) }
              : {}),
            ...(input.commissionedTo ? { commissionedTo: parseDate(input.commissionedTo) } : {}),
            ...(input.liabilityUntil ? { liabilityUntil: parseDate(input.liabilityUntil) } : {}),
            ...(input.liabilitySumEur !== undefined
              ? { liabilitySumEur: input.liabilitySumEur }
              : {}),
            ...(input.employerOrganisationId !== undefined
              ? { employerOrganisationId: input.employerOrganisationId }
              : {}),
            ...(input.originPostalCode !== undefined
              ? { originPostalCode: input.originPostalCode?.trim() || null }
              : {}),
            ...(input.originCity !== undefined
              ? { originCity: input.originCity?.trim() || null }
              : {}),
            ...(input.radiusKm !== undefined ? { radiusKm: input.radiusKm } : {}),
            dispatchOrigin: "organisation",
            ...(input.validTo !== undefined
              ? {
                  validTo:
                    input.validTo && input.validTo.trim()
                      ? parseDate(input.validTo)
                      : null,
                }
              : {}),
          },
        });
      });

      await recordAudit({
        actor: actorFromPartnerOrg(ctx),
        resource: "org_membership",
        resourceId: membershipId,
        action: "update",
        summary: "Updated external inspector",
      });

      return this.get(ctx, membershipId);
    });
  },

  async addSkill(
    ctx: PartnerContext,
    membershipId: string,
    input: ConsoleStaffSkillCreateInput,
  ): Promise<ConsoleStaffMemberDTO> {
    requirePartnerPermission(ctx, "console:external:manage");
    return runWithoutTenantAsync(async () => {
      const membership = await requireExternalMembership(ctx, membershipId);
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
    requirePartnerPermission(ctx, "console:external:manage");
    return runWithoutTenantAsync(async () => {
      const membership = await requireExternalMembership(ctx, membershipId);
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
    requirePartnerPermission(ctx, "console:external:manage");
    return runWithoutTenantAsync(async () => {
      const membership = await requireExternalMembership(ctx, membershipId);
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
    requirePartnerPermission(ctx, "console:external:manage");
    return runWithoutTenantAsync(async () => {
      const membership = await requireExternalMembership(ctx, membershipId);
      const row = await prisma.personQualification.findFirst({
        where: { id: qualificationId, userId: membership.userId },
      });
      if (!row) throw notFound("Qualification not found.");
      await prisma.personQualification.delete({ where: { id: qualificationId } });
      return this.get(ctx, membershipId);
    });
  },
};
