import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { updateCatalogModelSchema } from "@/schemas/catalogModel";
import { deviceModelCatalogService } from "@/services/catalog/deviceModelCatalogService";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/catalog/models/[id] — DeviceModel detail (catalog:view). */
export async function GET(_req: Request, context: RouteContext) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(_req);
    correlationId = ctx.correlationId;
    const { id } = await context.params;
    const model = await deviceModelCatalogService.getById(ctx, id);
    return Response.json({ model }, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** PATCH /api/catalog/models/[id] — update DeviceModel (catalog:update). */
export async function PATCH(req: Request, context: RouteContext) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const { id } = await context.params;
    const input = updateCatalogModelSchema.parse(await req.json());
    const model = await deviceModelCatalogService.update(ctx, id, input);
    return Response.json({ model }, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
