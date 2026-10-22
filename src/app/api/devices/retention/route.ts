import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { deviceInventoryService } from "@/services/inventory/deviceInventoryService";

/** GET — retired devices whose § 13 retainUntil has passed (eligible for purge). */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const devices = await deviceInventoryService.listRetentionEligible(ctx);
      return Response.json({ devices }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
