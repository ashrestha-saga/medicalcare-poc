import type { PartnerContext } from "@/interfaces/session";
import type { ConsoleDutyListDTO, ConsoleRequestListDTO } from "@/interfaces/console";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { prisma } from "@/lib/prisma";
import { isLiveContract } from "@/services/access/partnerAccessService";

async function liveTenantMap(organisationId: string) {
  const now = new Date();
  // Always bypass — ServiceContract is tenant-scoped; callers also wrap, but this is safe alone.
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
  async listDueDates(ctx: PartnerContext): Promise<ConsoleDutyListDTO> {
    const now = new Date();
    return runWithoutTenantAsync(async () => {
      const tenants = await liveTenantMap(ctx.organisationId);
      const tenantIds = [...tenants.keys()];
      if (tenantIds.length === 0) return { rows: [] };

      const duties = await prisma.deviceDuty.findMany({
        where: {
          tenantId: { in: tenantIds },
          applicable: true,
          suspendedAt: null,
          dueAt: { not: null },
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
        take: 200,
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

  async listRequests(ctx: PartnerContext): Promise<ConsoleRequestListDTO> {
    return runWithoutTenantAsync(async () => {
      const tenants = await liveTenantMap(ctx.organisationId);
      const tenantIds = [...tenants.keys()];
      if (tenantIds.length === 0) return { rows: [] };

      const rows = await prisma.serviceRequest.findMany({
        where: { tenantId: { in: tenantIds } },
        include: {
          executorOrg: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });

      return {
        rows: rows.map((r) => {
          const tenant = tenants.get(r.tenantId);
          return {
            tenantId: r.tenantId,
            tenantCode: tenant?.code ?? null,
            tenantName: tenant?.name ?? r.tenantId,
            reference: r.reference,
            deviceLabel: r.locationText || r.subjectId,
            serviceType: r.serviceType,
            state: r.state,
            executorName: r.executorOrg?.name ?? null,
            raisedAt: r.createdAt.toISOString(),
          };
        }),
      };
    });
  },
};
