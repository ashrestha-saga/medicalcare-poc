import type { PartnerContext } from "@/interfaces/session";
import type {
  ConsoleClinicDTO,
  ConsoleClinicDetailDTO,
  ConsoleClinicListDTO,
  ConsoleClinicStaffRowDTO,
  ConsoleRequestRowDTO,
  CreateClinicResult,
} from "@/interfaces/console";
import type { CreateClinicParsed, UpdateClinicContractParsed } from "@/schemas/console";
import { parseContractScope } from "@/constants/partnerPermissions";
import { actorFromPartnerOnTenant } from "@/lib/auth/actorContext";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { changedFields, recordAudit } from "@/services/audit/auditService";
import {
  assertOrgHasServiceProvider,
  isLiveContract,
} from "@/services/access/partnerAccessService";
import { requirePartnerPermission } from "@/lib/auth/tenantContext";
import { getCachedPartnerConsolePermissions } from "@/services/roles/roleGrantsService";
import { invitationService } from "@/services/users/invitationService";
import {
  dispositionDisplayState,
  nextDispositionDisplayState,
} from "@/services/console/dispositionService";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function siteCodeFromName(name: string): string {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 12);
  return slug || "SITE";
}

function institutionOrgCode(tenantCode: string): string {
  return tenantCode.replace(/^T-/, "");
}

/** Denormalized Site.address display line from structured fields. */
export function formatSiteAddress(parts: {
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
}): string | null {
  const street = parts.street?.trim() || "";
  const postalCity = [parts.postalCode?.trim(), parts.city?.trim()].filter(Boolean).join(" ");
  const country = parts.country?.trim();
  const countryPart = country && country !== "DE" ? country : "";
  const line = [street, postalCity, countryPart].filter(Boolean).join(", ");
  return line || parts.city?.trim() || null;
}

function toClinicDTO(args: {
  tenantId: string;
  tenantCode: string | null;
  tenantName: string;
  city: string | null;
  operatingModel: string;
  siteCount: number;
  deviceCount: number;
  contractId: string;
  validFrom: Date;
  validTo: Date | null;
  billingRef: string | null;
  avvRef?: string | null;
  scope: string[];
  live: boolean;
  suspendedAt?: Date | null;
  terminatedAt?: Date | null;
  overdueDuties?: number;
  openClarifications?: number;
  openMpsb?: number;
}): ConsoleClinicDTO {
  return {
    tenantId: args.tenantId,
    tenantCode: args.tenantCode,
    tenantName: args.tenantName,
    city: args.city,
    operatingModel: args.operatingModel,
    siteCount: args.siteCount,
    deviceCount: args.deviceCount,
    contractId: args.contractId,
    validFrom: isoDate(args.validFrom),
    validTo: args.validTo ? isoDate(args.validTo) : null,
    billingRef: args.billingRef,
    avvRef: args.avvRef ?? null,
    scope: args.scope,
    live: args.live,
    suspendedAt: args.suspendedAt?.toISOString() ?? null,
    terminatedAt: args.terminatedAt?.toISOString() ?? null,
    overdueDuties: args.overdueDuties,
    openClarifications: args.openClarifications,
    openMpsb: args.openMpsb,
  };
}

function toDetail(
  dto: ConsoleClinicDTO,
  extras: Omit<ConsoleClinicDetailDTO, keyof ConsoleClinicDTO | "suspendedAt" | "terminatedAt"> & {
    suspendedAt?: string | null;
    terminatedAt?: string | null;
  },
): ConsoleClinicDetailDTO {
  return {
    ...dto,
    suspendedAt: extras.suspendedAt ?? dto.suspendedAt ?? null,
    terminatedAt: extras.terminatedAt ?? dto.terminatedAt ?? null,
    address: extras.address,
    contact: extras.contact,
    mpsbStatus: extras.mpsbStatus,
    mpsbName: extras.mpsbName,
    avvMissing: extras.avvMissing,
    staff: extras.staff,
    assignments: extras.assignments,
  };
}

export const clinicOnboardService = {
  async list(ctx: PartnerContext): Promise<ConsoleClinicListDTO> {
    const now = new Date();
    const [organisation, contracts] = await runWithoutTenantAsync(() =>
      Promise.all([
        prisma.organisation.findFirst({
          where: { id: ctx.organisationId },
          select: { id: true, name: true },
        }),
        prisma.serviceContract.findMany({
          where: { organisationId: ctx.organisationId },
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                code: true,
                operatingModel: true,
                sites: {
                  select: { address: true, city: true },
                  take: 1,
                  orderBy: { id: "asc" },
                },
                _count: { select: { sites: true, instances: true } },
              },
            },
          },
          orderBy: { validFrom: "desc" },
        }),
      ]),
    );

    const clinics = contracts.map((c) =>
      toClinicDTO({
        tenantId: c.tenantId,
        tenantCode: c.tenant.code,
        tenantName: c.tenant.name,
        city: c.tenant.sites[0]?.city ?? c.tenant.sites[0]?.address ?? null,
        operatingModel: c.tenant.operatingModel,
        siteCount: c.tenant._count.sites,
        deviceCount: c.tenant._count.instances,
        contractId: c.id,
        validFrom: c.validFrom,
        validTo: c.validTo,
        billingRef: c.billingRef,
        avvRef: c.avvRef,
        scope: parseContractScope(c.scope),
        live: isLiveContract(c, now),
        suspendedAt: c.suspendedAt,
        terminatedAt: c.terminatedAt,
      }),
    );

    const liveTenantIds = clinics.filter((c) => c.live).map((c) => c.tenantId);
    const [overdueDuties, openClarifications, openMpsb] =
      liveTenantIds.length === 0
        ? [0, 0, 0]
        : await runWithoutTenantAsync(async () => {
            const [overdue, clarifications, sites, appointments] = await Promise.all([
              prisma.deviceDuty.count({
                where: {
                  tenantId: { in: liveTenantIds },
                  applicable: true,
                  suspendedAt: null,
                  dueAt: { lt: now },
                },
              }),
              prisma.deviceClarification.count({
                where: {
                  tenantId: { in: liveTenantIds },
                  resolvedAt: null,
                },
              }),
              prisma.site.findMany({
                where: { tenantId: { in: liveTenantIds } },
                select: { id: true },
              }),
              prisma.safetyOfficerAppointment.findMany({
                where: {
                  tenantId: { in: liveTenantIds },
                  appointedFrom: { lte: now },
                  OR: [{ appointedTo: null }, { appointedTo: { gte: now } }],
                },
                select: { siteId: true },
              }),
            ]);
            const covered = new Set(appointments.map((a) => a.siteId));
            return [overdue, clarifications, sites.filter((s) => !covered.has(s.id)).length] as const;
          });

    return {
      organisationId: ctx.organisationId,
      organisationName: organisation?.name ?? ctx.user.organisationName,
      myAppRole: String(ctx.user.appRole),
      canCreate: getCachedPartnerConsolePermissions(ctx.user.appRole).includes("console:customers:create"),
      clinics,
      kpis: {
        customersTotal: clinics.length,
        customersLive: clinics.filter((c) => c.live).length,
        devicesManaged: clinics.reduce((sum, c) => sum + c.deviceCount, 0),
        overdueDuties,
        openClarifications,
        openMpsb,
      },
    };
  },

  async getByContractId(ctx: PartnerContext, contractId: string): Promise<ConsoleClinicDetailDTO> {
    requirePartnerPermission(ctx, "console:customers:view");
    const now = new Date();
    const row = await runWithoutTenantAsync(() =>
      prisma.serviceContract.findFirst({
        where: { id: contractId, organisationId: ctx.organisationId },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              code: true,
              operatingModel: true,
              institutionOrgId: true,
              sites: {
                select: {
                  id: true,
                  street: true,
                  postalCode: true,
                  city: true,
                  country: true,
                  address: true,
                },
                orderBy: { id: "asc" },
              },
              _count: { select: { sites: true, instances: true } },
            },
          },
        },
      }),
    );
    if (!row) throw notFound("Contract not found.");

    const tenantId = row.tenantId;
    const sites = row.tenant.sites;
    const primarySite =
      sites.find((s) => s.postalCode || s.street || s.address) ?? sites[0] ?? null;
    const address =
      primarySite == null
        ? null
        : formatSiteAddress({
            street: primarySite.street,
            postalCode: primarySite.postalCode,
            city: primarySite.city,
            country: primarySite.country,
          }) || primarySite.address;

    const [institution, appointments, memberships, requests] = await runWithoutTenantAsync(() =>
      Promise.all([
        row.tenant.institutionOrgId
          ? prisma.organisation.findFirst({
              where: { id: row.tenant.institutionOrgId },
              select: { contact: true },
            })
          : Promise.resolve(null),
        prisma.safetyOfficerAppointment.findMany({
          where: {
            tenantId,
            appointedFrom: { lte: now },
            OR: [{ appointedTo: null }, { appointedTo: { gte: now } }],
          },
          select: { personName: true, siteId: true },
          orderBy: { appointedFrom: "desc" },
        }),
        prisma.orgMembership.findMany({
          where: {
            organisationId: ctx.organisationId,
            isExternal: false,
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
              },
            },
            staffAssignments: { where: { tenantId }, select: { tenantId: true } },
          },
          orderBy: [{ appRole: "asc" }, { user: { name: "asc" } }],
        }),
        prisma.serviceRequest.findMany({
          where: {
            tenantId,
            transmittedAt: { not: null },
            state: { not: "rejected" },
          },
          include: {
            executorOrg: { select: { name: true, code: true, organisationId: true } },
            assigneeUser: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
      ]),
    );

    const siteIds = new Set(sites.map((s) => s.id));
    const coveredSites = new Set(
      appointments.filter((a) => siteIds.has(a.siteId)).map((a) => a.siteId),
    );
    const mpsbOpen = sites.length === 0 || [...siteIds].some((id) => !coveredSites.has(id));
    const mpsbName = appointments[0]?.personName?.trim() || null;

    const staff: ConsoleClinicStaffRowDTO[] = memberships.map((m) => {
      const accessLocked = m.appRole === "admin";
      const assigned = accessLocked || m.staffAssignments.length > 0;
      return {
        membershipId: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        jobTitle: m.user.jobTitle,
        appRole: String(m.appRole),
        assigned,
        accessLocked,
        qualifications: m.user.qualifications.map((q) => ({
          id: q.id,
          code: q.qualification.code,
          label: q.qualification.label,
          validUntil: q.validUntil ? isoDate(q.validUntil) : null,
        })),
      };
    });

    const assignments: ConsoleRequestRowDTO[] = requests.map((r) => ({
      tenantId: r.tenantId,
      tenantCode: row.tenant.code,
      tenantName: row.tenant.name,
      reference: r.reference,
      deviceLabel: r.locationText || r.subjectId,
      deviceDetail: null,
      serviceType: r.serviceType,
      state: r.state,
      executorOrgId: r.executorOrgId,
      executorName: r.executorOrg?.name ?? null,
      executorCode: r.executorOrg?.code?.replace(/^O-/i, "") ?? null,
      assigneeUserId: r.assigneeUserId,
      assigneeName: r.assigneeUser?.name ?? null,
      scheduledAt: r.scheduledAt ? r.scheduledAt.toISOString() : null,
      displayState: dispositionDisplayState(r.state, r.assigneeUserId, r.scheduledAt),
      nextDisplayState: nextDispositionDisplayState(
        dispositionDisplayState(r.state, r.assigneeUserId, r.scheduledAt),
      ),
      raisedAt: r.createdAt.toISOString(),
      managed: true,
      isExecutor: r.executorOrg?.organisationId === ctx.organisationId,
    }));

    const scope = parseContractScope(row.scope);
    const live = isLiveContract(row, now);
    const base = toClinicDTO({
      tenantId,
      tenantCode: row.tenant.code,
      tenantName: row.tenant.name,
      city: primarySite?.city ?? primarySite?.address ?? null,
      operatingModel: row.tenant.operatingModel,
      siteCount: row.tenant._count.sites,
      deviceCount: row.tenant._count.instances,
      contractId: row.id,
      validFrom: row.validFrom,
      validTo: row.validTo,
      billingRef: row.billingRef,
      avvRef: row.avvRef,
      scope,
      live,
      suspendedAt: row.suspendedAt,
      terminatedAt: row.terminatedAt,
    });

    return toDetail(base, {
      address,
      contact: institution?.contact?.trim() || null,
      mpsbStatus: mpsbOpen ? "open" : "appointed",
      mpsbName: mpsbOpen ? null : mpsbName,
      avvMissing:
        row.tenant.operatingModel === "provider_operated" && !row.avvRef?.trim(),
      staff,
      assignments,
    });
  },

  async updateContract(
    ctx: PartnerContext,
    contractId: string,
    input: UpdateClinicContractParsed,
  ): Promise<ConsoleClinicDetailDTO> {
    requirePartnerPermission(ctx, "console:contracts:update");
    const existing = await runWithoutTenantAsync(() =>
      prisma.serviceContract.findFirst({
        where: { id: contractId, organisationId: ctx.organisationId },
        include: { tenant: true },
      }),
    );
    if (!existing) throw notFound("Contract not found.");
    if (existing.terminatedAt) throw forbidden();

    const before = {
      validFrom: isoDate(existing.validFrom),
      validTo: existing.validTo ? isoDate(existing.validTo) : null,
      billingRef: existing.billingRef,
      avvRef: existing.avvRef,
      scope: parseContractScope(existing.scope),
      operatingModel: existing.tenant.operatingModel,
    };

    await runWithoutTenantAsync(async () => {
      await prisma.serviceContract.update({
        where: { id: contractId },
        data: {
          ...(input.validFrom ? { validFrom: new Date(`${input.validFrom}T00:00:00.000Z`) } : {}),
          ...(input.validTo !== undefined
            ? {
                validTo:
                  input.validTo && input.validTo.trim()
                    ? new Date(`${input.validTo}T00:00:00.000Z`)
                    : null,
              }
            : {}),
          ...(input.billingRef !== undefined
            ? { billingRef: input.billingRef?.trim() ? input.billingRef.trim() : null }
            : {}),
          ...(input.avvRef !== undefined
            ? { avvRef: input.avvRef?.trim() ? input.avvRef.trim() : null }
            : {}),
          ...(input.scope ? { scope: JSON.stringify(input.scope) } : {}),
        },
      });
      if (input.operatingModel && input.operatingModel !== existing.tenant.operatingModel) {
        await prisma.tenant.update({
          where: { id: existing.tenantId },
          data: { operatingModel: input.operatingModel },
        });
      }
    });

    const after = await this.getByContractId(ctx, contractId);
    const diff = changedFields(before, {
      validFrom: after.validFrom,
      validTo: after.validTo,
      billingRef: after.billingRef,
      avvRef: after.avvRef,
      scope: after.scope,
      operatingModel: after.operatingModel,
    });
    if (diff) {
      await recordAudit({
        actor: actorFromPartnerOnTenant(ctx, after.tenantId, contractId),
        resource: "contract",
        resourceId: contractId,
        action: "update",
        summary: `Updated management contract for ${after.tenantCode ?? after.tenantName}`,
        before: diff.before,
        after: diff.after,
      });
    }
    return after;
  },

  async create(ctx: PartnerContext, input: CreateClinicParsed): Promise<CreateClinicResult> {
    requirePartnerPermission(ctx, "console:customers:create");
    await assertOrgHasServiceProvider(ctx.organisationId);

    const tenantCode = input.tenantCode;
    const orgCode = institutionOrgCode(tenantCode);
    const validFrom = new Date(`${input.validFrom}T00:00:00.000Z`);
    const billingRef = input.billingRef?.trim() ? input.billingRef.trim() : null;
    const avvRef = input.avvRef?.trim() ? input.avvRef.trim() : null;
    const scope = JSON.stringify(input.scope);
    const grantedFrom = new Date();

    const [codeTaken, orgTaken] = await runWithoutTenantAsync(() =>
      Promise.all([
        prisma.tenant.findFirst({ where: { code: tenantCode }, select: { id: true } }),
        prisma.organisation.findFirst({ where: { code: orgCode }, select: { id: true } }),
      ]),
    );
    if (codeTaken) throw conflict("Tenant identifier already in use.", { field: "tenantCode" });
    if (orgTaken) throw conflict("An organisation with this identifier already exists.", { field: "tenantCode" });

    const contactEmail = input.contactEmail.trim().toLowerCase();
    const contactName = input.contactName?.trim() || "";
    const emailTaken = await prisma.user.findUnique({
      where: { email: contactEmail },
      select: { id: true },
    });
    if (emailTaken) {
      throw conflict("A user with this email already exists.", { field: "contactEmail" });
    }

    const created = await runWithoutTenantAsync(() =>
      prisma.$transaction(async (tx) => {
        const contact =
          contactName && contactEmail
            ? `${contactName} · ${contactEmail}`
            : contactName || contactEmail || null;

        const institution = await tx.organisation.create({
          data: {
            code: orgCode,
            name: input.name,
            contact,
            activeFrom: grantedFrom,
          },
        });
        await tx.organisationRole.create({
          data: {
            organisationId: institution.id,
            role: "institution",
            grantedFrom,
          },
        });
        const tenant = await tx.tenant.create({
          data: {
            name: input.name,
            code: tenantCode,
            operatingModel: input.operatingModel,
            institutionOrgId: institution.id,
          },
        });
        const street = input.street?.trim() || null;
        const postalCode = input.postalCode?.trim() || null;
        const city = input.city.trim();
        const country = (input.country?.trim() || "DE").toUpperCase();
        const site = await tx.site.create({
          data: {
            tenantId: tenant.id,
            name: input.siteName,
            code: siteCodeFromName(input.siteName),
            street,
            postalCode,
            city,
            country,
            address: formatSiteAddress({ street, postalCode, city, country }),
          },
        });
        const mpsbName = input.mpsbName?.trim() || "";
        if (mpsbName) {
          await tx.safetyOfficerAppointment.create({
            data: {
              tenantId: tenant.id,
              siteId: site.id,
              personName: mpsbName,
              functionalEmail: contactEmail || null,
              appointedFrom: validFrom,
            },
          });
        }
        const contract = await tx.serviceContract.create({
          data: {
            tenantId: tenant.id,
            organisationId: ctx.organisationId,
            validFrom,
            validTo: null,
            billingRef,
            avvRef,
            scope,
          },
        });
        return { tenant, contract, institution };
      }),
    );

    const actor = actorFromPartnerOnTenant(ctx, created.tenant.id, created.contract.id);
    await recordAudit({
      actor,
      resource: "tenant",
      resourceId: created.tenant.id,
      action: "create",
      summary: `Onboarded clinic ${tenantCode} with management contract`,
      after: {
        tenantCode,
        name: input.name,
        city: input.city,
        siteName: input.siteName,
        operatingModel: input.operatingModel,
        scope: input.scope,
        institutionOrgId: created.institution.id,
        contractId: created.contract.id,
        contactEmail,
      },
    });

    const invite = await invitationService.inviteClinicSuperadminOnOnboard(ctx, {
      tenantId: created.tenant.id,
      email: contactEmail,
      name: contactName || null,
    });

    return {
      clinic: toClinicDTO({
        tenantId: created.tenant.id,
        tenantCode: created.tenant.code,
        tenantName: created.tenant.name,
        city: input.city,
        operatingModel: created.tenant.operatingModel,
        siteCount: 1,
        deviceCount: 0,
        contractId: created.contract.id,
        validFrom: created.contract.validFrom,
        validTo: created.contract.validTo,
        billingRef: created.contract.billingRef,
        avvRef: created.contract.avvRef,
        scope: input.scope,
        live: true,
      }),
      invite: {
        email: invite.email,
        emailSimulated: invite.emailSimulated,
        redeemUrl: invite.redeemUrl,
      },
    };
  },
};
