import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { reprocessingEvidenceService } from "@/services/reprocessingEvidence/reprocessingEvidenceService";

/**
 * GET /api/reprocessing/execution?scope=equipment|water,chemistry|sterile_storage&day=YYYY-MM-DD
 * Daily execution status per device (equipment) or per site (water/sterile).
 */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const params = new URL(req.url).searchParams;
      const scopeRaw = params.get("scope") ?? "equipment";
      const scopes = scopeRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const day = params.get("day") ?? undefined;
      const execution = await reprocessingEvidenceService.listExecution(ctx, { scopes, day });
      return Response.json(execution, {
        headers: { "x-correlation-id": ctx.correlationId },
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
