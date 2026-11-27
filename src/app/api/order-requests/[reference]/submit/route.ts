import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { submitShopOrderSchema } from "@/schemas/shop";
import { shopOrderService } from "@/services/shop/shopOrderService";

type Ctx = { params: Promise<{ reference: string }> };

/** POST /api/order-requests/[reference]/submit — PIN-gated shop checkout. */
export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { reference } = await params;
      const input = submitShopOrderSchema.parse(await req.json().catch(() => ({})));
      const result = await shopOrderService.submit(decodeURIComponent(reference), input, ctx);
      return Response.json(result, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
