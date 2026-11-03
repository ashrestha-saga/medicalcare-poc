import {
  withTenantBypass,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { inspectAccessService } from "@/services/pruefpartner/inspectAccessService";

/** GET /api/partner/inspect/access — Mein Zugang evidence for current user. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:nav", "inspections:view");
      correlationId = ctx.correlationId;
      const data = await inspectAccessService.forCurrentUser(ctx);
      return Response.json(data, {
        headers: {
          "x-correlation-id": ctx.correlationId,
          "Cache-Control": "private, max-age=60",
        },
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
