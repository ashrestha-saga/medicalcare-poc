import {
  withTenantBypass,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { prisma } from "@/lib/prisma";
import { isLiveContract } from "@/services/access/partnerAccessService";

/** GET /api/partner/search?q= — customers + open orders. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:nav");
      correlationId = ctx.correlationId;
      const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
      if (q.length < 2) {
        return Response.json(
          { customers: [], orders: [] },
          { headers: { "x-correlation-id": ctx.correlationId } },
        );
      }
      const data = await runWithoutTenantAsync(async () => {
        const now = new Date();
        const contracts = await prisma.serviceContract.findMany({
          where: { organisationId: ctx.organisationId },
          include: { tenant: { select: { id: true, name: true, code: true } } },
        });
        const live = contracts.filter((c) => isLiveContract(c, now));
        const needle = q.toLowerCase();
        const customers = live
          .filter((c) =>
            [c.tenant.name, c.tenant.code ?? "", c.id].join(" ").toLowerCase().includes(needle),
          )
          .slice(0, 10)
          .map((c) => ({
            contractId: c.id,
            tenantId: c.tenantId,
            name: c.tenant.name,
            code: c.tenant.code,
            href: `/partner/customers/${c.id}`,
          }));
        const tenantIds = live.map((c) => c.tenantId);
        const orders =
          tenantIds.length === 0
            ? []
            : (
                await prisma.serviceRequest.findMany({
                  where: {
                    tenantId: { in: tenantIds },
                    transmittedAt: { not: null },
                    OR: [
                      { reference: { contains: q } },
                      { locationText: { contains: q } },
                    ],
                  },
                  take: 10,
                  orderBy: { createdAt: "desc" },
                  select: { reference: true, tenantId: true, serviceType: true },
                })
              ).map((r) => ({
                reference: r.reference,
                tenantId: r.tenantId,
                serviceType: r.serviceType,
                href: `/partner/orders?q=${encodeURIComponent(r.reference)}`,
              }));
        return { customers, orders };
      });
      return Response.json(data, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
