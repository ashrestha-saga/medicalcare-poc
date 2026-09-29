import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { releaseService } from "@/services/registration/releaseService";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/registration/drafts/[id]/derive */
export async function POST(req: Request, ctx: Ctx) {
  let correlationId: string | undefined;
  try {
    const session = await requireTenantContext(req);
    return await withTenantStore(session, async () => {
      correlationId = session.correlationId;
      const { id } = await ctx.params;
      const preview = await releaseService.derivePreview(session, id);
      return Response.json(preview, { headers: { "x-correlation-id": session.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
