import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { routineCheckService } from "@/services/routines/routineCheckService";

/** GET /api/routine-checks/open-today — IFU routines still open in the current cadence window (E105). */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const items = await routineCheckService.listOpenToday(ctx);
      return Response.json(
        { items, count: items.length },
        { headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
