import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { dguvDeterminationSchema } from "@/schemas/radiationDguv";
import { dguvDeterminationService } from "@/services/duties/dguvDeterminationService";

type Ctx = { params: Promise<{ id: string }> };

/** PUT /api/devices/:id/duties/dguv/determination — E85 / R32 */
export async function PUT(req: Request, ctxParams: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await ctxParams.params;
      const input = dguvDeterminationSchema.parse(await req.json());
      const result = await dguvDeterminationService.determine(ctx, id, input);
      return Response.json({ determination: result }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
