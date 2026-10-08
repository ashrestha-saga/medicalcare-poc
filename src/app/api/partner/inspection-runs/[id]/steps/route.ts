import { requireActingContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { saveInspectionStepsSchema } from "@/schemas/pruefpartner";
import { inspectionRunService } from "@/services/pruefpartner/inspectionRunService";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/partner/inspection-runs/[id]/steps */
export async function PATCH(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    const { id } = await params;
    correlationId = ctx.correlationId;
    const body = saveInspectionStepsSchema.parse(await req.json());
    await inspectionRunService.saveSteps(ctx, id, body.steps);
    return Response.json({ ok: true }, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
