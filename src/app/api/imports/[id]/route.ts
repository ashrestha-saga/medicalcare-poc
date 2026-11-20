import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { importJobService } from "@/services/import/importJobService";
import { isInventoryImportEnabled } from "@/services/import/featureFlag";

/** GET /api/imports/:id */
export async function GET(req: Request, ctxParams: { params: Promise<{ id: string }> }) {
  let correlationId: string | undefined;
  try {
    const { id } = await ctxParams.params;
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      await isInventoryImportEnabled(ctx.tenantId);
      const url = new URL(req.url);
      const quality = url.searchParams.get("quality") || undefined;
      const outcome = url.searchParams.get("outcome") || undefined;
      const result = await importJobService.get(ctx, id, { quality, outcome });
      return Response.json(result, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
