import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { startSiteVisitSchema } from "@/schemas/pruefpartner";
import { inspectionRunService } from "@/services/pruefpartner/inspectionRunService";

/** POST /api/partner/inspect/visits/start — start ServiceVisit for a site day-plan group. */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    correlationId = ctx.correlationId;
    const body = startSiteVisitSchema.parse(await req.json().catch(() => ({})));
    const data = await withTenantStore(ctx, () =>
      inspectionRunService.startSiteVisit(ctx, {
        siteId: body.siteId ?? null,
        references: body.references,
      }),
    );
    return Response.json(data, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
