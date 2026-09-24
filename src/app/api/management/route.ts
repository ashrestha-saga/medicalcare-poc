import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { managementService } from "@/services/management/managementService";

/** GET /api/management — active partner contracts for this clinic (management:view). */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const overview = await managementService.getOverview(ctx);
    return Response.json(overview, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
