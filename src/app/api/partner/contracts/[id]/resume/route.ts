import {
  withTenantBypass,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { contractLifecycleService } from "@/services/access/contractLifecycleService";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/partner/contracts/[id]/resume */
export async function POST(req: Request, ctx: Ctx) {
  let correlationId: string | undefined;
  try {
    const partner = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(partner, "console:contracts:lifecycle");
      correlationId = partner.correlationId;
      const { id } = await ctx.params;
      const result = await contractLifecycleService.resumeByPartner(partner, id);
      return Response.json(result, { headers: { "x-correlation-id": partner.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
