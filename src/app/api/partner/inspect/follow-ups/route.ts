import {
  withTenantBypass,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { inspectFollowUpService } from "@/services/pruefpartner/inspectFollowUpService";

/** GET /api/partner/inspect/follow-ups — own Nachbesuch proposals for the inspect rail. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(
        ctx,
        "inspections:view",
        "inspection:propose",
        "console:nav",
      );
      correlationId = ctx.correlationId;
      const data = await inspectFollowUpService.listForCurrentUser(ctx);
      return Response.json(data, {
        headers: {
          "x-correlation-id": ctx.correlationId,
          "Cache-Control": "private, max-age=30",
        },
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
