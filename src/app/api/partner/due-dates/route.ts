import {
  withTenantBypass,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { partnerPortfolioService } from "@/services/console/partnerPortfolioService";

/** GET /api/partner/due-dates — duties across live managed tenants. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:due-dates:view");
      correlationId = ctx.correlationId;
      const url = new URL(req.url);
      const overdueOnly = url.searchParams.get("overdue") === "1";
      const tenantId = url.searchParams.get("tenantId")?.trim() || undefined;
      const data = await partnerPortfolioService.listDueDates(ctx, { overdueOnly, tenantId });
      return Response.json(data, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
