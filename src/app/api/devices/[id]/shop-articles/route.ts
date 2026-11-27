import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { shopCatalogService } from "@/services/shop/shopCatalogService";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/devices/[id]/shop-articles — device article + accessories from the shop. */
export async function GET(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await params;
      const result = await shopCatalogService.getDeviceShopArticles(id, ctx);
      return Response.json(result, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
