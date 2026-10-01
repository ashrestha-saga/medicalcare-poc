import {
  withTenantBypass,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { dispositionService } from "@/services/console/dispositionService";

type Ctx = { params: Promise<{ tenantId: string }> };

/** GET /api/partner/my-sites/[tenantId] — institution assignments portal. */
export async function GET(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    const { tenantId } = await params;
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:disposition:view");
      correlationId = ctx.correlationId;
      const data = await dispositionService.getSitePortal(ctx, decodeURIComponent(tenantId));
      return Response.json(data, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
