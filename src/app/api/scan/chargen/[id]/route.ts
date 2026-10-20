import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { scanChargeService } from "@/services/scan/scanChargeService";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/scan/chargen/[id] — charge detail + freigabe hurdles. */
export async function GET(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const { id } = await params;
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const batch = await scanChargeService.get(ctx, id);
      return Response.json({ batch }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
