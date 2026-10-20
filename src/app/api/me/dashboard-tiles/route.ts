import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { dashboardTileService } from "@/services/dashboard/dashboardTileService";

/** GET /api/me/dashboard-tiles — effective tiles for the signed-in clinic user. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const tiles = await dashboardTileService.resolveForUser(ctx);
      return Response.json({ tiles }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
