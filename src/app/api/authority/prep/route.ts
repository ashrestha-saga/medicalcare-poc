import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { getBegehPrep, liveChecklistCoverage } from "@/services/authority/begehPrepService";

/** GET — live Begehung prep: gaps + live checklist coverage. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const [prep, checklists] = await Promise.all([
        getBegehPrep(ctx),
        liveChecklistCoverage(ctx),
      ]);
      return Response.json(
        { prep, checklists },
        { headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
