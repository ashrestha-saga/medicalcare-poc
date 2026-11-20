import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { resolveConstancyDeviationSchema } from "@/schemas/k10";
import { constancyRoutineService } from "@/services/constancy/constancyRoutineService";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/clarifications/:id/resolve-constancy — E88 lock | continue. */
export async function POST(req: Request, ctxParams: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await ctxParams.params;
      const input = resolveConstancyDeviationSchema.parse(await req.json());
      const result = await constancyRoutineService.resolveDeviation(ctx, id, input);
      return Response.json({ result }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}