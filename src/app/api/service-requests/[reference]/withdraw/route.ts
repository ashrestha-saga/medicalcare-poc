import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { serviceRequestService } from "@/services/requests/serviceRequestService";

type RouteContext = { params: Promise<{ reference: string }> };

/** POST /api/service-requests/[reference]/withdraw — remove a wrong assignment. */
export async function POST(req: Request, ctx: RouteContext) {
  let correlationId: string | undefined;
  try {
    const auth = await requireTenantContext(req);
    return await withTenantStore(auth, async () => {
      correlationId = auth.correlationId;
      const { reference } = await ctx.params;
      const result = await serviceRequestService.withdraw(reference, auth);
      return Response.json(result, {
        headers: { "x-correlation-id": auth.correlationId },
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
