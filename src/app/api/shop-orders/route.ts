import { requireActingContext, requirePermission, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { shopOrderService } from "@/services/shop/shopOrderService";

/** GET /api/shop-orders — admin/management shop order list + summary. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      requirePermission(ctx, "shop-orders:view");
      const result = await shopOrderService.listShopOrders(ctx.tenantId);
      return Response.json(result, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
