import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { transitionServiceRequestSchema } from "@/schemas/serviceRequest";
import { serviceRequestService } from "@/services/requests/serviceRequestService";

/**
 * POST /api/service-requests/:reference/transition
 * Technician/admin Start (in_progress) or Complete (completed + work note).
 */
export async function POST(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const { reference } = await params;
    const input = transitionServiceRequestSchema.parse(await req.json());
    const request = await serviceRequestService.transition(reference, input, ctx);
    return Response.json(request, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
