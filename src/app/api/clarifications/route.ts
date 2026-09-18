import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { clarificationService } from "@/services/clarifications/clarificationService";

/** GET /api/clarifications — inventory data-quality list (clarifications:view). */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const result = await clarificationService.list(ctx);
    return Response.json(result, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
