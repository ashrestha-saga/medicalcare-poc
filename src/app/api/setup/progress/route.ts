import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { setupProgressService } from "@/services/setup/setupProgressService";

/** GET /api/setup/progress — Erstanlage checklist for the sidebar chip. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const progress = await setupProgressService.getProgress(ctx);
      return Response.json(progress, {
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
