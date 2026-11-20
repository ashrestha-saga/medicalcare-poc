import { z } from "zod";
import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { collectiveOrderService } from "@/services/orders/collectiveOrderService";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  deviceInstanceId: z.string().trim().min(1),
  reason: z.string().trim().min(1).max(2000),
});

/** POST /api/requests/group/:id/skip — skip one Sammelauftrag item (R39). */
export async function POST(req: Request, ctxParams: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await ctxParams.params;
      const body = schema.parse(await req.json());
      const progress = await collectiveOrderService.skipItem(
        ctx,
        id,
        body.deviceInstanceId,
        body.reason,
      );
      return Response.json({ progress }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
