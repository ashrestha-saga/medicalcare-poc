import type { PartnerContext } from "@/interfaces/session";
import type {
  ConsoleClinicDTO,
  ConsoleClinicDetailDTO,
  ConsoleClinicListDTO,
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
  scope: string[];
  live: boolean;
  suspendedAt?: Date | null;
  terminatedAt?: Date | null;
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
    scope: args.scope,
    live: args.live,
    suspendedAt: args.suspendedAt?.toISOString() ?? null,
    terminatedAt: args.terminatedAt?.toISOString() ?? null,
  };
}

function toDetail(dto: ConsoleClinicDTO): ConsoleClinicDetailDTO {
  return {
    ...dto,
    suspendedAt: dto.suspendedAt ?? null,
    terminatedAt: dto.terminatedAt ?? null,
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
        scope: parseContractScope(c.scope),
        live: isLiveContract(c, now),
        suspendedAt: c.suspendedAt,
        terminatedAt: c.terminatedAt,
      }),
    );

    const liveTenantIds = clinics.filter((c) => c.live).map((c) => c.tenantId);
    const overdueDuties =
      liveTenantIds.length === 0
        ? 0
        : await runWithoutTenantAsync(() =>
            prisma.deviceDuty.count({
              where: {
                tenantId: { in: liveTenantIds },
                applicable: true,
                suspendedAt: null,
                dueAt: { lt: now },
              },
            }),
          );

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
      },
    };
  },

  async getByContractId(ctx: PartnerContext, contractId: string): Promise<ConsoleClinicDetailDTO> {
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
              sites: { select: { address: true, city: true }, take: 1, orderBy: { id: "asc" } },
              _count: { select: { sites: true, instances: true } },
            },
          },
        },
      }),
    );
    if (!row) throw notFound("Contract not found.");
    return toDetail(
      toClinicDTO({
        tenantId: row.tenantId,
        tenantCode: row.tenant.code,
        tenantName: row.tenant.name,
        city: row.tenant.sites[0]?.city ?? row.tenant.sites[0]?.address ?? null,
        operatingModel: row.tenant.operatingModel,
        siteCount: row.tenant._count.sites,
        deviceCount: row.tenant._count.instances,
        contractId: row.id,
        validFrom: row.validFrom,
        validTo: row.validTo,
        billingRef: row.billingRef,
        scope: parseContractScope(row.scope),
        live: isLiveContract(row, now),
        suspendedAt: row.suspendedAt,
        terminatedAt: row.terminatedAt,
      }),
    );
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

    const created = await runWithoutTenantAsync(() =>
      prisma.$transaction(async (tx) => {
        const institution = await tx.organisation.create({
          data: {
            code: orgCode,
            name: input.name,
            contact: null,
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
        await tx.site.create({
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
        const contract = await tx.serviceContract.create({
          data: {
            tenantId: tenant.id,
            organisationId: ctx.organisationId,
            validFrom,
            validTo: null,
            billingRef,
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
      },
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
        scope: input.scope,
        live: true,
      }),
    };
  },
};
