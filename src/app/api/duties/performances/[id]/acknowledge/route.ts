import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { acknowledgePerformanceSchema } from "@/schemas/reports";
import { reportAckService } from "@/services/reports/reportAckService";

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/duties/performances/:id/acknowledge — clinic confirms a report (requests:approve). */
export async function POST(req: Request, ctxParams: RouteContext) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await ctxParams.params;
      const input = acknowledgePerformanceSchema.parse(await req.json().catch(() => ({})));
      const result = await reportAckService.acknowledge(ctx, id, input);
      return Response.json({ result }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
