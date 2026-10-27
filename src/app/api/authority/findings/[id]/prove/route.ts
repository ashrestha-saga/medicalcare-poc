import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { proveFindingSchema } from "@/schemas/k10";
import { authorityService } from "@/services/authority/authorityService";

/** POST /api/authority/findings/:id/prove — remediated → proven (R7). */
export async function POST(
  req: Request,
  ctxParams: { params: Promise<{ id: string }> },
) {
  let correlationId: string | undefined;
  try {
    const { id } = await ctxParams.params;
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const body = proveFindingSchema.parse(await req.json());
      const row = await authorityService.prove(ctx, id, body);
      return Response.json(row, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
