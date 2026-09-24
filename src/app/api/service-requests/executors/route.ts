import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { serviceRequestService } from "@/services/requests/serviceRequestService";

/** GET /api/service-requests/executors — FA-713 allocator options. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const auth = await requireTenantContext(req);
    correlationId = auth.correlationId;
    const executors = await serviceRequestService.listExecutors(auth);
    return Response.json(
      { executors },
      { headers: { "x-correlation-id": auth.correlationId } },
    );
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
