import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { dueDatesQuerySchema } from "@/schemas/dueDates";
import { dueDatesService } from "@/services/dueDates/dueDatesService";

/** GET /api/due-dates — duty due-date board (duties:view). */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      dueDatesQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams.entries()));
      const board = await dueDatesService.listBoard(ctx);
      return Response.json(board, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
