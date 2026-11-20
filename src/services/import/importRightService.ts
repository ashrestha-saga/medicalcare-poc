import type { TenantWorkContext } from "@/interfaces/session";
import { notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";

/** E81 — Dienstleister darf Bestand importieren (ServiceContractScopeGrant import:manage). */
export const importRightService = {
  async get(ctx: TenantWorkContext) {
    const tenant = await prisma.tenant.findFirst({
      where: { id: ctx.tenantId },
      select: { operatingModel: true },
    });
    if (!tenant) throw notFound("Tenant");
    const contract = await prisma.serviceContract.findFirst({
      where: {
        tenantId: ctx.tenantId,
        terminatedAt: null,
        suspendedAt: null,
      },
      orderBy: { validFrom: "desc" },
      include: {
        scopeGrants: { where: { permission: "import:manage" } },
      },
    });
    const grant = contract?.scopeGrants[0];
    const allowed = Boolean(grant && !grant.denied);
    const defaultOn = tenant.operatingModel === "provider_operated";
    return {
      operatingModel: tenant.operatingModel,
      allowed: grant ? allowed : defaultOn && tenant.operatingModel === "provider_operated" ? false : allowed,
      /** Effective: explicit grant, else default by operating model when no row. */
      effective:
        grant != null
          ? !grant.denied
          : tenant.operatingModel === "provider_operated",
      grant: grant
        ? { id: grant.id, denied: grant.denied, source: grant.source }
        : null,
      contractId: contract?.id ?? null,
      defaultOn,
    };
  },

  async set(ctx: TenantWorkContext, enabled: boolean) {
    const current = await this.get(ctx);
    if (!current.contractId) {
      throw unprocessable("No active service contract — cannot set import right");
    }
    const contractId = current.contractId;
    if (enabled) {
      await prisma.serviceContractScopeGrant.upsert({
        where: {
          contractId_permission: { contractId, permission: "import:manage" },
        },
        create: {
          contractId,
          permission: "import:manage",
          denied: false,
          source: "manual",
        },
        update: { denied: false, source: "manual" },
      });
    } else {
      await prisma.serviceContractScopeGrant.upsert({
        where: {
          contractId_permission: { contractId, permission: "import:manage" },
        },
        create: {
          contractId,
          permission: "import:manage",
          denied: true,
          source: "manual",
        },
        update: { denied: true, source: "manual" },
      });
    }

    const actor = ctx.actor || {
      tenantId: ctx.tenantId,
      actorUserId: ctx.user.id,
      actorKind: ctx.user.accountKind,
      actorRole: ctx.user.role || ctx.user.appRole || null,
      actorName: ctx.user.name,
      organisationId: null,
      organisationName: null,
      serviceContractId: contractId,
      correlationId: ctx.correlationId || null,
      ip: null,
      userAgent: null,
    };

    await recordAudit({
      actor,
      resource: "ServiceContract",
      resourceId: contractId,
      action: "import_right.set",
      summary: enabled
        ? "Dienstleister darf den Bestand importieren"
        : "Importrecht für Dienstleister aus",
      after: { enabled },
    });

    return this.get(ctx);
  },

  /** Ensure default grant row for provider_operated contracts (seed / onboard). */
  async ensureDefaultGrant(contractId: string, operatingModel: string) {
    if (operatingModel !== "provider_operated") return;
    const existing = await prisma.serviceContractScopeGrant.findUnique({
      where: {
        contractId_permission: { contractId, permission: "import:manage" },
      },
    });
    if (existing) return;
    await prisma.serviceContractScopeGrant.create({
      data: {
        contractId,
        permission: "import:manage",
        denied: false,
        source: "token",
      },
    });
  },
};
