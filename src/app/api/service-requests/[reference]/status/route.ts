import { correlationFrom } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { statusFeedbackSchema } from "@/schemas/serviceRequest";
import { serviceRequestService } from "@/services/requests/serviceRequestService";

/**
 * FA-601/602 — POST /api/service-requests/:reference/status
 * Feedback webhook from OXID (or another dispatch target).
 * 404 on unknown reference — never a silent discard.
 *
 * ⚠ PENDING API SPEC — webhook authentication (signature / shared secret) is
 * unknown; add the check here once the contract lands. Until then the route is
 * only reachable on the pilot network.
 */
export async function POST(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const correlationId = correlationFrom(req);
  try {
    const { reference } = await params;
    const feedback = statusFeedbackSchema.parse(await req.json());
    const updated = await serviceRequestService.applyStatusFeedback(reference, feedback);
    logger.info("status.feedback_applied", { correlationId, reference, state: feedback.state, source: feedback.source });
    return Response.json({ reference: updated.reference, state: updated.state, statusEvents: updated.statusEvents });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
