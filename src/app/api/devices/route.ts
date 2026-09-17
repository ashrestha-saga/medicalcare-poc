import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { createDeviceSchema } from "@/schemas/device";
import { deviceInventoryService } from "@/services/inventory/deviceInventoryService";

/** GET /api/devices?q=&siteId=&serial=&modelId= — tenant device inventory (inventory:view). */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const params = new URL(req.url).searchParams;
    const serial = params.get("serial")?.trim();
    if (serial) {
      const modelId = params.get("modelId")?.trim() || null;
      const device = await deviceInventoryService.findBySerial(ctx, serial, modelId);
      return Response.json({ device }, { headers: { "x-correlation-id": ctx.correlationId } });
    }
    const q = params.get("q") ?? undefined;
    const siteId = params.get("siteId") ?? undefined;
    const devices = await deviceInventoryService.list(ctx, { q, siteId });
    return Response.json({ devices }, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** POST /api/devices — inventarize a model instance (inventory:update | requests:create). */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const input = createDeviceSchema.parse(await req.json());
    const device = await deviceInventoryService.create(ctx, input);
    return Response.json({ device }, { status: 201, headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
