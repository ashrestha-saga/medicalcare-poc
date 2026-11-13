import {
  requireActingContext,
  withTenantStore,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { confirmProposal } from "@/services/repairs/proposalService";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/partner/requests/:id/confirm-proposal — R15. */
export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await params;
      const sr = await prisma.serviceRequest.findFirst({
        where: { OR: [{ id }, { reference: id }], tenantId: ctx.tenantId },
        select: { id: true },
      });
      const row = await confirmProposal(ctx, sr?.id ?? id);
      return Response.json({ request: row }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
