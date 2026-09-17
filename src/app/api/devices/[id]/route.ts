import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { updateDeviceSchema } from "@/schemas/device";
import { deviceInventoryService } from "@/services/inventory/deviceInventoryService";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/devices/[id] — inventory detail (inventory:view). */
export async function GET(req: Request, ctx: RouteContext) {
  let correlationId: string | undefined;
  try {
    const auth = await requireTenantContext(req);
    correlationId = auth.correlationId;
    const { id } = await ctx.params;
    const device = await deviceInventoryService.get(auth, id);
    return Response.json({ device }, { headers: { "x-correlation-id": auth.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** PATCH /api/devices/[id] — update instance (+ linked model fields). Classification never accepted. */
export async function PATCH(req: Request, ctx: RouteContext) {
  let correlationId: string | undefined;
  try {
    const auth = await requireTenantContext(req);
    correlationId = auth.correlationId;
    const { id } = await ctx.params;
    const input = updateDeviceSchema.parse(await req.json());
    const device = await deviceInventoryService.update(auth, id, input);
    return Response.json({ device }, { headers: { "x-correlation-id": auth.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
