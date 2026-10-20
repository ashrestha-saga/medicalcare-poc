import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { authorityService } from "@/services/authority/authorityService";

/** GET /api/authority/findings?status=&hasDue=1 — flat findings list (authority:view). */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const params = new URL(req.url).searchParams;
      const status = params.get("status") ?? undefined;
      const findingId = params.get("findingId") ?? undefined;
      const hasDue = params.get("hasDue") === "1" || params.get("hasDue") === "true";
      const findings = await authorityService.listFindings(ctx, { status, hasDue, findingId });
      return Response.json({ findings }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
