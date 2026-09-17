import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { categorySearchQuerySchema } from "@/schemas/orderRequest";
import { oxidService, toSpareParts } from "@/services/oxid/oxidService";

/** GET /api/oxid/categories?q=&modelId= — category/article search for the parts flow. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const url = new URL(req.url);
    const query = categorySearchQuerySchema.parse({
      q: url.searchParams.get("q") ?? "",
      modelId: url.searchParams.get("modelId") ?? undefined,
    });
    const result = await oxidService.searchCategories({ query: query.q, modelId: query.modelId, tenantId: ctx.tenantId, correlationId });
    return Response.json({
      source: result.source,
      fetchedAt: result.fetchedAt,
      categories: result.categories,
      parts: toSpareParts(result, query.modelId),
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
