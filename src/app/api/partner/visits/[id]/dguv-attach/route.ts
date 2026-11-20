import { z } from "zod";
import {
  requirePartnerContext,
  requirePartnerPermission,
  withTenantBypass,
} from "@/lib/auth/tenantContext";
import { actorFromPartnerOnTenant } from "@/lib/auth/actorContext";
import { runWithTenantAsync } from "@/lib/auth/tenantStore";
import { errorResponse, notFound, unprocessable } from "@/lib/errors";
import { requireRadiationDguvEnabled } from "@/lib/features/radiationDguv";
import { prisma } from "@/lib/prisma";
import { assertPartnerManagesTenant } from "@/services/access/partnerAccessService";
import { collectiveOrderService } from "@/services/orders/collectiveOrderService";
import { intersectPartnerGrantsWithResolvedSlugs } from "@/constants/partnerPermissions";
import { getCachedPartnerActingPermissions } from "@/services/roles/roleGrantsService";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  deviceInstanceIds: z.array(z.string().min(1)).min(1).optional(),
});

/** POST /api/partner/visits/:id/dguv-attach — R42 accept DGUV mitnehmen. */
export async function POST(req: Request, ctxParams: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "visits:manage", "requests:create");
      correlationId = ctx.correlationId;
      const { id: visitId } = await ctxParams.params;
      const body = schema.parse(await req.json().catch(() => ({})));

      const visit = await prisma.serviceVisit.findFirst({
        where: { id: visitId, organisationId: ctx.organisationId },
      });
      if (!visit) throw notFound("Visit not found");
      if (!visit.siteId) throw unprocessable("Visit has no site", { field: "siteId" });

      const access = await assertPartnerManagesTenant(
        ctx.user.id,
        ctx.organisationId,
        visit.tenantId,
      );

      const tenant = await prisma.tenant.findUnique({
        where: { id: visit.tenantId },
        select: { featureFlags: true },
      });
      requireRadiationDguvEnabled(tenant?.featureFlags);

      const actingPerms = intersectPartnerGrantsWithResolvedSlugs(
        getCachedPartnerActingPermissions(access.appRole),
        access.permissionSlugs,
      );
      const actingCtx = {
        tenantId: visit.tenantId,
        correlationId: ctx.correlationId,
        user: { ...ctx.user, organisationName: access.organisationName },
        permissions: actingPerms,
        actor: actorFromPartnerOnTenant(ctx, visit.tenantId, access.contractId),
      };

      const result = await runWithTenantAsync(visit.tenantId, async () => {
        let deviceIds = body.deviceInstanceIds;
        if (!deviceIds?.length) {
          const hint = await collectiveOrderService.dguvMitnehmenHint(actingCtx, {
            siteId: visit.siteId!,
            technicianUserId: visit.technicianUserId || ctx.user.id,
            visitDate: visit.plannedAt?.toISOString().slice(0, 10),
          });
          deviceIds = hint.deviceIds;
        }
        if (!deviceIds.length) {
          throw unprocessable("No DGUV devices available to attach");
        }
        return collectiveOrderService.attachDguvToVisit(actingCtx, {
          siteId: visit.siteId!,
          visitId,
          deviceInstanceIds: deviceIds,
        });
      });

      return Response.json(
        { result },
        { status: 201, headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
