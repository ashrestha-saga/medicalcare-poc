import {
  requireActingContext,
  withTenantStore,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { discardProposalSchema } from "@/schemas/repairs";
import { discardProposal } from "@/services/repairs/proposalService";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/partner/requests/:id/discard-proposal — R15. */
export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await params;
      const input = discardProposalSchema.parse(await req.json().catch(() => ({})));
      const sr = await prisma.serviceRequest.findFirst({
        where: { OR: [{ id }, { reference: id }], tenantId: ctx.tenantId },
        select: { id: true },
      });
      const row = await discardProposal(ctx, sr?.id ?? id, input.note);
      return Response.json({ request: row }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
