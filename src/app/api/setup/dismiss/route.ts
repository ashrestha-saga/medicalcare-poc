import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { setupProgressService } from "@/services/setup/setupProgressService";

/** POST /api/setup/dismiss — acknowledge Inbetriebnahme at 10/10 (hide sidebar chip). */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const progress = await setupProgressService.dismiss(ctx);
      return Response.json(progress, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
