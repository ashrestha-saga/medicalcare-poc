import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { secondSiteVisitSchema } from "@/schemas/pruefpartner";
import { inspectionRunService } from "@/services/pruefpartner/inspectionRunService";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/partner/inspect/visits/:id/second — E34 second visit today (new travel). */
export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    correlationId = ctx.correlationId;
    const { id } = await params;
    const body = secondSiteVisitSchema.parse(await req.json().catch(() => ({})));
    const data = await withTenantStore(ctx, () =>
      inspectionRunService.startSecondSiteVisit(ctx, id, {
        reason: body.reason,
        note: body.note,
        references: body.references,
      }),
    );
    return Response.json(data, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
