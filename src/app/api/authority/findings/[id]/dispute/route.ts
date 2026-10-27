import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { disputeFindingSchema } from "@/schemas/k10";
import { authorityService } from "@/services/authority/authorityService";

/** POST /api/authority/findings/:id/dispute — open → disputed (R7). */
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
      const body = disputeFindingSchema.parse(await req.json());
      const row = await authorityService.dispute(ctx, id, body);
      return Response.json(row, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
