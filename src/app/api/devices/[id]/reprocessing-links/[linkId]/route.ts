import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { reprocessingLinkService } from "@/services/registration/reprocessingLinkService";

type Ctx = { params: Promise<{ id: string; linkId: string }> };

/** DELETE /api/devices/[id]/reprocessing-links/[linkId] */
export async function DELETE(req: Request, ctx: Ctx) {
  let correlationId: string | undefined;
  try {
    const acting = await requireActingContext(req);
    return await withTenantStore(acting, async () => {
      correlationId = acting.correlationId;
      const { linkId } = await ctx.params;
      const result = await reprocessingLinkService.unlink(acting, linkId);
      return Response.json(result, { headers: { "x-correlation-id": acting.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
