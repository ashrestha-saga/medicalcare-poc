import { correlationFrom, withTenantBypass } from "@/lib/auth/tenantContext";
import { assertStatusWebhook } from "@/lib/auth/statusWebhook";
import { badRequest, errorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { statusFeedbackSchema } from "@/schemas/serviceRequest";
import { serviceRequestService } from "@/services/requests/serviceRequestService";

/**
 * FA-601/602 — POST /api/service-requests/:reference/status
 * Signed feedback from a dispatch target. Does not complete a duty;
 * that record is written only by a sealed inspection or an in-app completion.
 */
export async function POST(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const correlationId = correlationFrom(req);
  try {
    const raw = await req.text();
    assertStatusWebhook(raw, req.headers.get("x-devicecare-signature"));
    return await withTenantBypass(async () => {
      const { reference } = await params;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw) as unknown;
      } catch {
        throw badRequest("Status body must be JSON.");
      }
      const feedback = statusFeedbackSchema.parse(parsed);
      const updated = await serviceRequestService.applyStatusFeedback(reference, feedback);
      logger.info("status.feedback_applied", {
        correlationId,
        reference,
        state: feedback.state,
        source: feedback.source,
      });
      return Response.json({
        reference: updated.reference,
        state: updated.state,
        statusEvents: updated.statusEvents,
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
