import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { dutyService } from "@/services/registration/dutyService";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/devices/[id]/duties — open (unsuspended) duties for one instance. */
export async function GET(req: Request, ctx: RouteContext) {
  let correlationId: string | undefined;
  try {
    const auth = await requireTenantContext(req);
    correlationId = auth.correlationId;
    const { id } = await ctx.params;
    const duties = await dutyService.listForDevice(auth, id);
    return Response.json({ duties }, { headers: { "x-correlation-id": auth.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
