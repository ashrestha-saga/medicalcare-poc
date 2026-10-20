import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { createCatalogModelSchema } from "@/schemas/catalogModel";
import { deviceModelCatalogService } from "@/services/catalog/deviceModelCatalogService";

/** GET /api/catalog/models?q=&missingClassification=1 — central DeviceModel list (catalog:view). */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const params = new URL(req.url).searchParams;
      const q = params.get("q") ?? undefined;
      const missingClassification =
        params.get("missingClassification") === "1" || params.get("missingClassification") === "true";
      const models = await deviceModelCatalogService.list(ctx, { q, missingClassification });
      return Response.json({ models }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** POST /api/catalog/models — create DeviceModel (catalog:update). */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = createCatalogModelSchema.parse(await req.json());
      const model = await deviceModelCatalogService.create(ctx, input);
      return Response.json({ model }, { status: 201, headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
