import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { authorityPreparationService } from "@/services/authority/authorityPreparationService";

/** GET /api/authority/overview?list=&site= — six tile counts (v26.1). */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const url = new URL(req.url);
      const list = url.searchParams.get("list");
      if (!list) {
        return Response.json(
          { error: { code: "bad_request", message: "list is required" } },
          { status: 400 },
        );
      }
      const site = url.searchParams.get("site");
      const overview = await authorityPreparationService.overview(ctx, list, site);
      return Response.json(overview, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
