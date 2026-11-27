import { requireActingContext, requirePermission, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { shopOrderService } from "@/services/shop/shopOrderService";

type Ctx = { params: Promise<{ reference: string }> };

/** GET /api/shop-orders/[reference] — shop order detail. */
export async function GET(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      requirePermission(ctx, "shop-orders:view");
      const { reference } = await params;
      const order = await shopOrderService.getByReference(ctx.tenantId, decodeURIComponent(reference));
      return Response.json({ order }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
