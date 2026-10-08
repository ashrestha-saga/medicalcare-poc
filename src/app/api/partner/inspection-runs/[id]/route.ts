import { requireActingContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { inspectionRunService } from "@/services/pruefpartner/inspectionRunService";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/partner/inspection-runs/[id] */
export async function GET(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    const { id } = await params;
    correlationId = ctx.correlationId;
    const run = await inspectionRunService.getRun(ctx, id);
    return Response.json({ run }, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
