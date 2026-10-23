import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { navCountsService } from "@/services/nav/navCountsService";

/** GET /api/nav/counts — sidebar aggregate tags for the acting clinic tenant. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const counts = await navCountsService.getCounts(ctx);
      return Response.json(counts, {
        headers: {
          "x-correlation-id": ctx.correlationId,
          "Cache-Control": "private, max-age=30",
        },
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
