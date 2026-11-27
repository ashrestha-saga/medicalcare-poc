import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { externalPerformanceSchema } from "@/schemas/externalPerformance";
import { externalPerformanceService } from "@/services/duties/externalPerformanceService";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/duties/:id/performances/external — clinic records a third-party performance (E108).
 * inventory:update or requests:create; rolls the due date via recordDutyCompletion.
 */
export async function POST(req: Request, ctxParams: RouteContext) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await ctxParams.params;
      const input = externalPerformanceSchema.parse(await req.json().catch(() => ({})));
      const result = await externalPerformanceService.record(ctx, id, input);
      return Response.json({ result }, { status: 201, headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
