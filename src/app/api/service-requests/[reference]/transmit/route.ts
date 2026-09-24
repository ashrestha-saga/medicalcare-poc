import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { serviceRequestService } from "@/services/requests/serviceRequestService";

type RouteContext = { params: Promise<{ reference: string }> };

/** POST /api/service-requests/[reference]/transmit — FA-714. */
export async function POST(req: Request, ctx: RouteContext) {
  let correlationId: string | undefined;
  try {
    const auth = await requireTenantContext(req);
    correlationId = auth.correlationId;
    const { reference } = await ctx.params;
    const request = await serviceRequestService.transmit(reference, auth);
    return Response.json(
      { request },
      { headers: { "x-correlation-id": auth.correlationId } },
    );
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
