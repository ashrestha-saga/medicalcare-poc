import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { createOrderRequestSchema } from "@/schemas/orderRequest";
import { orderRequestService } from "@/services/order/orderRequestService";

/** Section 37 — POST /api/order-requests. Always lands in pending_approval. */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const input = createOrderRequestSchema.parse(await req.json());
    const result = await orderRequestService.create(input, ctx);
    return Response.json(result, { status: result.created ? 201 : 200, headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    return Response.json({ orders: await orderRequestService.list(ctx.tenantId) });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
