import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { importJobService } from "@/services/import/importJobService";
import { isInventoryImportEnabled } from "@/services/import/featureFlag";

/** GET /api/imports/:id/unclassified-models */
export async function GET(req: Request, ctxParams: { params: Promise<{ id: string }> }) {
  let correlationId: string | undefined;
  try {
    const { id } = await ctxParams.params;
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      await isInventoryImportEnabled(ctx.tenantId);
      const models = await importJobService.unclassifiedModels(ctx, id);
      return Response.json({ models }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
