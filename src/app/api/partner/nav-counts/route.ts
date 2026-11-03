import {
  withTenantBypass,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { prismaSystem } from "@/lib/prisma";
import { isLiveContract } from "@/services/access/partnerAccessService";

/** GET /api/partner/nav-counts — actionable badge counts only. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:nav");
      correlationId = ctx.correlationId;
      // Cross-tenant fan-out: unguarded client (ALS can be duplicated across Turbopack chunks).
      const now = new Date();
      const contracts = await prismaSystem.serviceContract.findMany({
        where: { organisationId: ctx.organisationId },
      });
      const liveTenantIds = contracts.filter((c) => isLiveContract(c, now)).map((c) => c.tenantId);
      const membershipBase = {
        organisationId: ctx.organisationId,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gte: now } }],
        user: { active: true, accountKind: "partner" as const },
      };
      const [overdue, openOrders, customers, staff, externals] = await Promise.all([
        liveTenantIds.length === 0
          ? 0
          : prismaSystem.deviceDuty.count({
              where: {
                tenantId: { in: liveTenantIds },
                applicable: true,
                suspendedAt: null,
                dueAt: { lt: now },
              },
            }),
        prismaSystem.serviceRequest.count({
          where: {
            executorOrg: { organisationId: ctx.organisationId },
            transmittedAt: { not: null },
            state: {
              in: ["transmitted", "handed_off", "acknowledged", "scheduled", "in_progress"],
            },
          },
        }),
        liveTenantIds.length,
        prismaSystem.orgMembership.count({
          where: { ...membershipBase, isExternal: false },
        }),
        prismaSystem.orgMembership.count({
          where: { ...membershipBase, isExternal: true },
        }),
      ]);
      const data = {
        "console-today": overdue,
        "console-due-dates": overdue,
        "console-orders": openOrders,
        "console-disposition": openOrders,
        "console-customers": customers,
        "console-staff": staff,
        "console-external": externals,
      };
      return Response.json(data, {
        headers: {
          "x-correlation-id": ctx.correlationId,
          "Cache-Control": "private, max-age=60",
        },
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
