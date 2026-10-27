import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { setReadinessSchema } from "@/schemas/k10";
import { authorityPreparationService } from "@/services/authority/authorityPreparationService";

/** PUT /api/authority/readiness/:itemId — tick bereitgelegt (D14). */
export async function PUT(
  req: Request,
  ctxParams: { params: Promise<{ itemId: string }> },
) {
  let correlationId: string | undefined;
  try {
    const { itemId } = await ctxParams.params;
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const body = setReadinessSchema.parse(await req.json());
      const row = await authorityPreparationService.setReadiness(ctx, itemId, body);
      return Response.json(
        {
          itemId: row.itemId,
          externalReady: row.externalReady,
          documentRef: row.documentRef,
          checkedBy: row.checkedBy,
          checkedAt: row.checkedAt.toISOString(),
        },
        { headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
