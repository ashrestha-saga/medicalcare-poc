import {
  requirePartnerContext,
  requirePartnerPermission,
  withTenantBypass,
} from "@/lib/auth/tenantContext";
import { actorFromPartnerOnTenant } from "@/lib/auth/actorContext";
import { runWithTenantAsync } from "@/lib/auth/tenantStore";
import { errorResponse, notFound } from "@/lib/errors";
import { isRadiationDguvEnabled } from "@/lib/features/radiationDguv";
import { prisma } from "@/lib/prisma";
import { assertPartnerManagesTenant } from "@/services/access/partnerAccessService";
import { collectiveOrderService } from "@/services/orders/collectiveOrderService";
import { intersectPartnerGrantsWithResolvedSlugs } from "@/constants/partnerPermissions";
import { getCachedPartnerActingPermissions } from "@/services/roles/roleGrantsService";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/partner/visits/:id/dguv-hint — R42 hint for STK visit at site. */
export async function GET(req: Request, ctxParams: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "visits:manage", "console:disposition:view");
      correlationId = ctx.correlationId;
      const { id } = await ctxParams.params;

      const visit = await prisma.serviceVisit.findFirst({
        where: { id, organisationId: ctx.organisationId },
      });
      if (!visit) throw notFound("Visit not found");
      if (!visit.siteId) {
        return Response.json(
          { hint: { count: 0, deviceIds: [], show: false, reason: "no_site" } },
          { headers: { "x-correlation-id": ctx.correlationId } },
        );
      }

      const access = await assertPartnerManagesTenant(
        ctx.user.id,
        ctx.organisationId,
        visit.tenantId,
      );

      const tenant = await prisma.tenant.findUnique({
        where: { id: visit.tenantId },
        select: { featureFlags: true },
      });
      if (!isRadiationDguvEnabled(tenant?.featureFlags)) {
        return Response.json(
          { hint: { count: 0, deviceIds: [], show: false, reason: "flag_off" } },
          { headers: { "x-correlation-id": ctx.correlationId } },
        );
      }

      const url = new URL(req.url);
      const technicianUserId =
        url.searchParams.get("technicianUserId")?.trim() ||
        visit.technicianUserId ||
        ctx.user.id;

      const actingPerms = intersectPartnerGrantsWithResolvedSlugs(
        getCachedPartnerActingPermissions(access.appRole),
        access.permissionSlugs,
      );

      const hint = await runWithTenantAsync(visit.tenantId, async () =>
        collectiveOrderService.dguvMitnehmenHint(
          {
            tenantId: visit.tenantId,
            correlationId: ctx.correlationId,
            user: { ...ctx.user, organisationName: access.organisationName },
            permissions: actingPerms,
            actor: actorFromPartnerOnTenant(ctx, visit.tenantId, access.contractId),
          },
          {
            siteId: visit.siteId!,
            technicianUserId,
            visitDate: visit.plannedAt?.toISOString().slice(0, 10),
          },
        ),
      );

      return Response.json({ hint }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
