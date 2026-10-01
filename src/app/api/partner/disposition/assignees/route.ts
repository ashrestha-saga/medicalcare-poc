import {
  withTenantBypass,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { dispositionService } from "@/services/console/dispositionService";

/** GET /api/partner/disposition/assignees?tenantId= */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:disposition:view");
      correlationId = ctx.correlationId;
      const tenantId = new URL(req.url).searchParams.get("tenantId")?.trim() ?? "";
      const assignees = tenantId
        ? await dispositionService.assigneesForTenant(ctx, tenantId)
        : [];
      return Response.json({ assignees }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
