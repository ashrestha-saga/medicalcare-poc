import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { deviceBookService } from "@/services/deviceBook/deviceBookService";

/** GET — bookable device list, or composed § 13 book when deviceInstanceId is set. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const deviceInstanceId = new URL(req.url).searchParams.get("deviceInstanceId");
      if (deviceInstanceId) {
        const book = await deviceBookService.getComposed(ctx, deviceInstanceId);
        return Response.json({ book }, { headers: { "x-correlation-id": ctx.correlationId } });
      }
      const devices = await deviceBookService.listBookableDevices(ctx);
      return Response.json({ devices }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
