import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { isOrderingEnabled } from "@/lib/features/ordering";
import { prisma } from "@/lib/prisma";
import { createOrderRequestSchema } from "@/schemas/orderRequest";
import { orderRequestService } from "@/services/order/orderRequestService";
import { shopOrderService } from "@/services/shop/shopOrderService";

/** POST /api/order-requests — local approval request or shop intent when ordering is on. */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = createOrderRequestSchema.parse(await req.json());
      const tenant = await prisma.tenant.findUnique({
        where: { id: ctx.tenantId },
        select: { featureFlags: true },
      });
      const result = isOrderingEnabled(tenant?.featureFlags)
        ? await shopOrderService.createIntent(input, ctx)
        : await orderRequestService.create(input, ctx);
      return Response.json(result, {
        status: result.created ? 201 : 200,
        headers: { "x-correlation-id": ctx.correlationId },
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const tenant = await prisma.tenant.findUnique({
        where: { id: ctx.tenantId },
        select: { featureFlags: true },
      });
      const orders = isOrderingEnabled(tenant?.featureFlags)
        ? await shopOrderService.list(ctx.tenantId)
        : await orderRequestService.list(ctx.tenantId);
      return Response.json({ orders });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
