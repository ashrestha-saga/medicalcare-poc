import {
  requirePartnerContext,
  withTenantBypass,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { partsProposalOrderSchema } from "@/schemas/repairs";
import { orderPartsProposal } from "@/services/repairs/partsProposalService";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/partner/parts-proposals/:id/order */
export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      correlationId = ctx.correlationId;
      const { id } = await params;
      const input = partsProposalOrderSchema.parse(await req.json().catch(() => ({})));
      const proposal = await orderPartsProposal(ctx, id, input.orderRef);
      return Response.json({ proposal }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
