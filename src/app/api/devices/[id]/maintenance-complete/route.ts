import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { completeMaintenanceSchema } from "@/schemas/device";
import { deviceInventoryService } from "@/services/inventory/deviceInventoryService";

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/devices/[id]/maintenance-complete — mark done and roll next due. */
export async function POST(req: Request, ctx: RouteContext) {
  let correlationId: string | undefined;
  try {
    const auth = await requireTenantContext(req);
    correlationId = auth.correlationId;
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const input = completeMaintenanceSchema.parse(body ?? {});
    const device = await deviceInventoryService.completeMaintenance(auth, id, input);
    return Response.json({ device }, { headers: { "x-correlation-id": auth.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
