import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { dutyOverlapService } from "@/services/duties/dutyOverlapService";

/** POST — close overlap decision and reactivate covered duty if nothing else covers it. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await params;
      const decision = await dutyOverlapService.revoke(ctx, id);
      return Response.json({ decision }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
