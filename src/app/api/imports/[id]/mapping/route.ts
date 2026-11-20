import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { importJobService } from "@/services/import/importJobService";
import { isInventoryImportEnabled } from "@/services/import/featureFlag";

/** PUT /api/imports/:id/mapping */
export async function PUT(req: Request, ctxParams: { params: Promise<{ id: string }> }) {
  let correlationId: string | undefined;
  try {
    const { id } = await ctxParams.params;
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      await isInventoryImportEnabled(ctx.tenantId);
      const body = (await req.json()) as {
        sheets?: {
          name: string;
          siteId?: string | null;
          newSiteName?: string | null;
          columns?: { index: number; field: string | null; byUser?: boolean }[];
        }[];
      };
      const mapping = await importJobService.updateMapping(ctx, id, body as never);
      return Response.json({ mapping }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
