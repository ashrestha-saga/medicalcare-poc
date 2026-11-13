import {
  requirePartnerContext,
  requirePartnerPermission,
  withTenantBypass,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { partnerCreateOrderSchema } from "@/schemas/repairs";
import { partnerCreateOrder } from "@/services/repairs/partnerCreateOrderService";

/** POST /api/partner/orders — partner „Auftrag anlegen“. */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:disposition:assign");
      correlationId = ctx.correlationId;
      const input = partnerCreateOrderSchema.parse(await req.json().catch(() => ({})));
      const result = await partnerCreateOrder(ctx, input);
      const status = result.created ? 201 : result.request ? 200 : 200;
      return Response.json(result, {
        status,
        headers: { "x-correlation-id": ctx.correlationId },
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
