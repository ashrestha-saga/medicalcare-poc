import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse, notFound } from "@/lib/errors";
import { serviceRequestService } from "@/services/requests/serviceRequestService";

/** GET /api/service-requests/:reference — the UI polls this to show external status feedback. */
export async function GET(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const { reference } = await params;
    const request = await serviceRequestService.getByReference(reference, ctx.tenantId);
    if (!request) throw notFound(`Unknown service request reference ${reference}.`);
    return Response.json(request);
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
