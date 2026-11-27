import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { shopCatalogService } from "@/services/shop/shopCatalogService";

type Ctx = { params: Promise<{ oxid: string }> };

/** GET /api/shop/articles/[oxid] — article detail + variants (lazy on Add). */
export async function GET(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { oxid } = await params;
      const result = await shopCatalogService.getArticleDetail(decodeURIComponent(oxid), ctx);
      return Response.json(result, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
