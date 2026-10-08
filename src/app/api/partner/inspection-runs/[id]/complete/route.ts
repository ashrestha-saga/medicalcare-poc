import { requireActingContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { completeInspectionRunSchema } from "@/schemas/pruefpartner";
import { inspectionRunService } from "@/services/pruefpartner/inspectionRunService";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/partner/inspection-runs/[id]/complete */
export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    const { id } = await params;
    correlationId = ctx.correlationId;
    const idempotencyKey = req.headers.get("Idempotency-Key") ?? undefined;
    const body = completeInspectionRunSchema.parse(await req.json());
    const run = await inspectionRunService.completeRun(ctx, id, {
      ...body,
      idempotencyKey,
    });
    return Response.json({ run }, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
