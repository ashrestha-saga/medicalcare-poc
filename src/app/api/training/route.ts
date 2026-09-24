import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { createTrainingEventSchema } from "@/schemas/training";
import { trainingService } from "@/services/training/trainingService";

/** GET /api/training — clinic-only training overview (training:view). Partners forbidden. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const overview = await trainingService.getOverview(ctx);
    return Response.json(overview, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** POST /api/training — create event + one record per participant. */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const body = await req.json().catch(() => ({}));
    const input = createTrainingEventSchema.parse(body ?? {});
    const result = await trainingService.createEvent(ctx, input);
    return Response.json(result, {
      status: 201,
      headers: { "x-correlation-id": ctx.correlationId },
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
