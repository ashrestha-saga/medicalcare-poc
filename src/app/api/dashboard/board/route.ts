import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { dashboardBoardService } from "@/services/dashboard/dashboardBoardService";

/** GET /api/dashboard/board — persona dashboard with Zone-1 urgency trim. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const board = await dashboardBoardService.getBoard(ctx);
      return Response.json(board, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
