import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { importJobService } from "@/services/import/importJobService";
import { isInventoryImportEnabled } from "@/services/import/featureFlag";

/** GET /api/imports/:id/rest.csv */
export async function GET(req: Request, ctxParams: { params: Promise<{ id: string }> }) {
  let correlationId: string | undefined;
  try {
    const { id } = await ctxParams.params;
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      await isInventoryImportEnabled(ctx.tenantId);
      const csv = await importJobService.restCsv(ctx, id);
      return new Response(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="import-${id}-rest.csv"`,
          "x-correlation-id": ctx.correlationId,
        },
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
