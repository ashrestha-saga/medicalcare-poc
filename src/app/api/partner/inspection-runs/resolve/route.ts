import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { inspectionRunService } from "@/services/pruefpartner/inspectionRunService";

/** GET /api/partner/inspection-runs/resolve?reference= */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    correlationId = ctx.correlationId;
    const url = new URL(req.url);
    const reference = url.searchParams.get("reference");
    if (!reference) {
      return Response.json({ error: { message: "reference required" } }, { status: 400 });
    }
    const data = await withTenantStore(ctx, () =>
      inspectionRunService.resolvePreview(ctx, decodeURIComponent(reference)),
    );
    return Response.json(data, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
