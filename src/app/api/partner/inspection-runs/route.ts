import { requireActingContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { startInspectionRunSchema } from "@/schemas/pruefpartner";
import { inspectionRunService } from "@/services/pruefpartner/inspectionRunService";

/** POST /api/partner/inspection-runs — start or resume draft run. */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    correlationId = ctx.correlationId;
    const body = startInspectionRunSchema.parse(await req.json());
    const run = await inspectionRunService.startRun(ctx, body);
    return Response.json(
      { run },
      { status: 201, headers: { "x-correlation-id": ctx.correlationId } },
    );
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
