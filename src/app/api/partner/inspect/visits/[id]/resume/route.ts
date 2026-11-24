import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { inspectionRunService } from "@/services/pruefpartner/inspectionRunService";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/partner/inspect/visits/:id/resume — resume ended visit (no new travel). */
export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    correlationId = ctx.correlationId;
    const { id } = await params;
    const data = await withTenantStore(ctx, () => inspectionRunService.resumeSiteVisit(ctx, id));
    return Response.json(data, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
