import type { PartnerContext, TenantWorkContext } from "@/interfaces";
import { actorFromContext, actorFromPartnerOnTenant } from "@/lib/auth/actorContext";
import { requirePermission } from "@/lib/auth/tenantContext";
import { recordAudit } from "@/services/audit/auditService";
import { forbidden, notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import {
  assertOrgHasServiceProvider,
  assertPartnerManagesTenant,
} from "@/services/access/partnerAccessService";
import { requirePartnerPermission } from "@/lib/auth/tenantContext";

type ContractAction = "suspend" | "resume" | "terminate";

async function loadContract(contractId: string) {
  return runWithoutTenantAsync(() =>
    prisma.serviceContract.findFirst({
      where: { id: contractId },
      include: { tenant: { select: { id: true, name: true, operatingModel: true, code: true } } },
    }),
  );
}

/**
 * SCH-04/05 — who may mutate contract lifecycle:
 * - provider_operated → partner admin of the contracting org
 * - institution_operated → clinic superadmin of that tenant
 */
export const contractLifecycleService = {
  async suspendByPartner(ctx: PartnerContext, contractId: string) {
    requirePartnerPermission(ctx, "console:contracts:lifecycle");
    await assertOrgHasServiceProvider(ctx.organisationId);
    const preview = await loadContract(contractId);
    if (!preview) throw notFound("Contract not found.");
    return mutate(contractId, "suspend", {
      door: "partner",
      organisationId: ctx.organisationId,
      actor: actorFromPartnerOnTenant(ctx, preview.tenantId, contractId),
      assertPartner: async (tenantId) => {
        await assertPartnerManagesTenant(ctx.user.id, ctx.organisationId, tenantId);
      },
    });
  },

  async resumeByPartner(ctx: PartnerContext, contractId: string) {
    requirePartnerPermission(ctx, "console:contracts:lifecycle");
    await assertOrgHasServiceProvider(ctx.organisationId);
    const preview = await loadContract(contractId);
    if (!preview) throw notFound("Contract not found.");
    return mutate(contractId, "resume", {
      door: "partner",
      organisationId: ctx.organisationId,
      actor: actorFromPartnerOnTenant(ctx, preview.tenantId, contractId),
      assertPartner: async (tenantId) => {
        // Resume is allowed even if currently suspended — check org owns contract.
        const c = await prisma.serviceContract.findFirst({
          where: { id: contractId, organisationId: ctx.organisationId, tenantId },
        });
        if (!c) throw forbidden();
      },
    });
  },

  async terminateByPartner(ctx: PartnerContext, contractId: string) {
    requirePartnerPermission(ctx, "console:contracts:lifecycle");
    await assertOrgHasServiceProvider(ctx.organisationId);
    const preview = await loadContract(contractId);
    if (!preview) throw notFound("Contract not found.");
    return mutate(contractId, "terminate", {
      door: "partner",
      organisationId: ctx.organisationId,
      actor: actorFromPartnerOnTenant(ctx, preview.tenantId, contractId),
      assertPartner: async (tenantId) => {
        const c = await prisma.serviceContract.findFirst({
          where: { id: contractId, organisationId: ctx.organisationId, tenantId },
        });
        if (!c) throw forbidden();
      },
    });
  },

  async suspendByClinic(ctx: TenantWorkContext, contractId: string) {
    requirePermission(ctx, "users:update");
    if (ctx.user.role !== "superadmin") throw forbidden();
    return mutate(contractId, "suspend", {
      door: "clinic",
      tenantId: ctx.tenantId,
      actor: actorFromContext(ctx),
    });
  },

  async resumeByClinic(ctx: TenantWorkContext, contractId: string) {
    requirePermission(ctx, "users:update");
    if (ctx.user.role !== "superadmin") throw forbidden();
    return mutate(contractId, "resume", {
      door: "clinic",
      tenantId: ctx.tenantId,
      actor: actorFromContext(ctx),
    });
  },

  async terminateByClinic(ctx: TenantWorkContext, contractId: string) {
    requirePermission(ctx, "users:update");
    if (ctx.user.role !== "superadmin") throw forbidden();
    return mutate(contractId, "terminate", {
      door: "clinic",
      tenantId: ctx.tenantId,
      actor: actorFromContext(ctx),
    });
  },
};

async function mutate(
  contractId: string,
  action: ContractAction,
  opts: {
    door: "partner" | "clinic";
    organisationId?: string;
    tenantId?: string;
    actor: Parameters<typeof recordAudit>[0]["actor"];
    assertPartner?: (tenantId: string) => Promise<void>;
  },
) {
  return runWithoutTenantAsync(async () => {
    const row = await loadContract(contractId);
    if (!row) throw notFound("Contract not found.");

    const model = row.tenant.operatingModel;
    if (opts.door === "partner") {
      if (model !== "provider_operated") {
        throw forbidden(); // institution_operated clinics suspend themselves
      }
      if (opts.organisationId && row.organisationId !== opts.organisationId) throw forbidden();
      if (opts.assertPartner) await opts.assertPartner(row.tenantId);
    } else {
      if (model !== "institution_operated") {
        throw forbidden(); // provider_operated: only partner admin
      }
      if (opts.tenantId && row.tenantId !== opts.tenantId) throw forbidden();
    }

    if (action === "terminate" && row.terminatedAt) {
      throw unprocessable("Contract already terminated.");
    }
    if (action === "suspend" && row.terminatedAt) {
      throw unprocessable("Cannot suspend a terminated contract.");
    }
    if (action === "suspend" && row.suspendedAt) {
      throw unprocessable("Contract already suspended.");
    }
    if (action === "resume" && row.terminatedAt) {
      throw unprocessable("Cannot resume a terminated contract.");
    }
    if (action === "resume" && !row.suspendedAt) {
      throw unprocessable("Contract is not suspended.");
    }

    const now = new Date();
    const data =
      action === "suspend"
        ? { suspendedAt: now }
        : action === "resume"
          ? { suspendedAt: null }
          : { terminatedAt: now, suspendedAt: row.suspendedAt ?? now };

    const updated = await prisma.serviceContract.update({
      where: { id: row.id },
      data,
    });

    await recordAudit({
      actor: opts.actor,
      resource: "contract",
      resourceId: row.id,
      action: "transition",
      summary: `${action} contract for tenant ${row.tenant.code ?? row.tenant.name}`,
      before: { suspendedAt: row.suspendedAt, terminatedAt: row.terminatedAt },
      after: { suspendedAt: updated.suspendedAt, terminatedAt: updated.terminatedAt },
    });

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      organisationId: updated.organisationId,
      suspendedAt: updated.suspendedAt?.toISOString() ?? null,
      terminatedAt: updated.terminatedAt?.toISOString() ?? null,
      action,
    };
  });
}
