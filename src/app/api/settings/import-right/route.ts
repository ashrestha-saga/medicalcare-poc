import { requirePermission, requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { importRightService } from "@/services/import/importRightService";

/** GET /api/settings/import-right */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      requirePermission(ctx, "inventory:update");
      const result = await importRightService.get(ctx);
      return Response.json(result, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** PATCH /api/settings/import-right { enabled: boolean } */
export async function PATCH(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      requirePermission(ctx, "inventory:update");
      const body = (await req.json()) as { enabled?: boolean };
      const result = await importRightService.set(ctx, Boolean(body.enabled));
      return Response.json(result, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
