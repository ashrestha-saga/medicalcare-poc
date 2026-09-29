import {
  withTenantBypass,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { partnerAuditService } from "@/services/console/partnerAuditService";

/** GET /api/partner/audit — org-scoped audit trail. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:audit:view");
      correlationId = ctx.correlationId;
      const limit = Number(new URL(req.url).searchParams.get("limit") ?? "100");
      const data = await partnerAuditService.list(ctx, limit);
      return Response.json(data, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
