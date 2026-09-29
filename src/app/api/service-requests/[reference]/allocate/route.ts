import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { allocateServiceRequestSchema } from "@/schemas/serviceRequest";
import { serviceRequestService } from "@/services/requests/serviceRequestService";

type RouteContext = { params: Promise<{ reference: string }> };

/** POST /api/service-requests/[reference]/allocate — FA-713. */
export async function POST(req: Request, ctx: RouteContext) {
  let correlationId: string | undefined;
  try {
    const auth = await requireTenantContext(req);
    return await withTenantStore(auth, async () => {
      correlationId = auth.correlationId;
      const { reference } = await ctx.params;
      const body = allocateServiceRequestSchema.parse(await req.json());
      const request = await serviceRequestService.allocate(reference, body, auth);
      return Response.json(
        { request },
        { headers: { "x-correlation-id": auth.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
