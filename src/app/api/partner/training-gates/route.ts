import {
  requirePartnerContext,
  withTenantBypass,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { trainingGateSchema } from "@/schemas/repairs";
import { listTrainingGates, setTrainingGate } from "@/services/repairs/trainingGateService";

/** GET /api/partner/training-gates */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      correlationId = ctx.correlationId;
      const gates = await listTrainingGates(ctx);
      return Response.json({ gates }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** PUT /api/partner/training-gates */
export async function PUT(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      correlationId = ctx.correlationId;
      const input = trainingGateSchema.parse(await req.json().catch(() => ({})));
      const gate = await setTrainingGate(ctx, input);
      return Response.json({ gate }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
