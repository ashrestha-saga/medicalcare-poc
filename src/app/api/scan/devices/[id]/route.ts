import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { scanDeviceCardService } from "@/services/scan/scanDeviceCardService";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/scan/devices/[id] — device card with Sperrlage + primary action. */
export async function GET(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const { id } = await params;
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const card = await scanDeviceCardService.get(ctx, id);
      return Response.json({ card }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
