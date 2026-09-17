import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { createCatalogModelSchema } from "@/schemas/catalogModel";
import { deviceModelCatalogService } from "@/services/catalog/deviceModelCatalogService";

/** GET /api/catalog/models?q= — central DeviceModel list (catalog:view). */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const q = new URL(req.url).searchParams.get("q") ?? undefined;
    const models = await deviceModelCatalogService.list(ctx, q);
    return Response.json({ models }, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** POST /api/catalog/models — create DeviceModel (catalog:update). */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const input = createCatalogModelSchema.parse(await req.json());
    const model = await deviceModelCatalogService.create(ctx, input);
    return Response.json({ model }, { status: 201, headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
