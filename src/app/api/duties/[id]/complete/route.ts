import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { completeDutySchema } from "@/schemas/registration";
import { dutyService } from "@/services/registration/dutyService";
import { deviceInventoryService } from "@/services/inventory/deviceInventoryService";

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/duties/[id]/complete — record completion and roll the next due date. */
export async function POST(req: Request, ctx: RouteContext) {
  let correlationId: string | undefined;
  try {
    const auth = await requireTenantContext(req);
    correlationId = auth.correlationId;
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const input = completeDutySchema.parse(body ?? {});
    const duty = await dutyService.complete(auth, id, input);
    const device = await deviceInventoryService.get(auth, duty.deviceInstanceId);
    return Response.json({ duty, device }, { headers: { "x-correlation-id": auth.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
