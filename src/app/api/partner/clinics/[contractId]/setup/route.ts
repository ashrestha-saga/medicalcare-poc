import {
  withTenantBypass,
  withTenantStore,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { actorFromPartnerOnTenant } from "@/lib/auth/actorContext";
import { errorResponse, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { setupProgressService } from "@/services/setup/setupProgressService";
import { isLiveContract } from "@/services/access/partnerAccessService";

type RouteContext = { params: Promise<{ contractId: string }> };

/** GET /api/partner/clinics/[contractId]/setup — shared commissioning metrics (read). */
export async function GET(req: Request, ctx: RouteContext) {
  let correlationId: string | undefined;
  try {
    const partner = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(partner, "console:customers:view");
      correlationId = partner.correlationId;
      const { contractId } = await ctx.params;
      const contract = await prisma.serviceContract.findFirst({
        where: { id: contractId, organisationId: partner.organisationId },
      });
      if (!contract) throw notFound("Contract not found.");
      if (!isLiveContract(contract)) {
        return Response.json(
          { live: false, progress: null },
          { headers: { "x-correlation-id": partner.correlationId } },
        );
      }
      const acting = {
        tenantId: contract.tenantId,
        user: partner.user,
        correlationId: partner.correlationId,
        requestMeta: partner.requestMeta,
        permissions: ["shell:nav"] as const,
        actor: actorFromPartnerOnTenant(partner, contract.tenantId, contract.id),
      };
      const progress = await withTenantStore(acting, () =>
        setupProgressService.getProgress(acting),
      );
      return Response.json(
        { live: true, progress },
        { headers: { "x-correlation-id": partner.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
