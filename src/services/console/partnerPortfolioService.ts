import type { PartnerContext } from "@/interfaces/session";
import type { ConsoleDutyListDTO } from "@/interfaces/console";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { prisma } from "@/lib/prisma";
import { isLiveContract } from "@/services/access/partnerAccessService";

async function liveTenantMap(organisationId: string) {
  const now = new Date();
  const contracts = await runWithoutTenantAsync(() =>
    prisma.serviceContract.findMany({
      where: { organisationId },
      include: { tenant: { select: { id: true, name: true, code: true } } },
    }),
  );
  const live = contracts.filter((c) => isLiveContract(c, now));
  return new Map(live.map((c) => [c.tenantId, c.tenant]));
}

export const partnerPortfolioService = {
  async listDueDates(
    ctx: PartnerContext,
    opts?: { overdueOnly?: boolean; tenantId?: string },
  ): Promise<ConsoleDutyListDTO> {
    const now = new Date();
    return runWithoutTenantAsync(async () => {
      const tenants = await liveTenantMap(ctx.organisationId);
      let tenantIds = [...tenants.keys()];
      if (opts?.tenantId) {
        if (!tenants.has(opts.tenantId)) return { rows: [] };
        tenantIds = [opts.tenantId];
      }
      if (tenantIds.length === 0) return { rows: [] };

      const duties = await prisma.deviceDuty.findMany({
        where: {
          tenantId: { in: tenantIds },
          applicable: true,
          suspendedAt: null,
          dueAt: { not: null, ...(opts?.overdueOnly ? { lt: now } : {}) },
        },
        include: {
          deviceInstance: {
            select: {
              inventoryNumber: true,
              model: { select: { tradeName: true, modelName: true } },
            },
          },
        },
        orderBy: { dueAt: "asc" },
        take: 500,
      });

      return {
        rows: duties.map((d) => {
          const tenant = tenants.get(d.tenantId);
          const model = d.deviceInstance.model;
          const deviceLabel =
            model?.tradeName || model?.modelName || d.deviceInstance.inventoryNumber || d.dutyKey;
          return {
            tenantId: d.tenantId,
            tenantCode: tenant?.code ?? null,
            tenantName: tenant?.name ?? d.tenantId,
            dutyId: d.id,
            inventoryNumber: d.deviceInstance.inventoryNumber,
            deviceLabel,
            dutyKey: d.dutyKey,
            title: d.title,
            deadlineAnchor: d.deadlineAnchor,
            dueAt: d.dueAt?.toISOString() ?? null,
            confidence: d.confidence,
            overdue: Boolean(d.dueAt && d.dueAt.getTime() < now.getTime()),
          };
        }),
      };
    });
  },
};
