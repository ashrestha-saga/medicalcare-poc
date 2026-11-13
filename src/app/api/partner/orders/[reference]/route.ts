import {
  requirePartnerContext,
  requirePartnerPermission,
  withTenantBypass,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { getPartnerOrderDetail } from "@/services/repairs/partnerOrderDetailService";

type Ctx = { params: Promise<{ reference: string }> };

/** GET /api/partner/orders/[reference] — repair-rich order detail. */
export async function GET(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:disposition:view");
      correlationId = ctx.correlationId;
      const { reference } = await params;
      const order = await getPartnerOrderDetail(ctx, decodeURIComponent(reference));
      return Response.json(
        { order },
        { headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
