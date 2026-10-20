import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { fieldSafetyService } from "@/services/fieldSafety/fieldSafetyService";

type Ctx = { params: Promise<{ id: string }> };

/** POST — enqueue inventory candidates from affectedModels (Abgleich, affected=null). */
export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const { id } = await params;
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const action = await fieldSafetyService.suggestCandidates(ctx, id);
      return Response.json({ action }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
