import {
  requireActingContext,
  withTenantStore,
} from "@/lib/auth/tenantContext";
import { errorResponse, badRequest } from "@/lib/errors";
import { createPartsProposal } from "@/services/repairs/partsProposalService";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/partner/requests/:id/parts-proposal — R21. */
export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      if (ctx.user.accountKind !== "partner") {
        throw badRequest("Parts proposals are created by partner staff");
      }
      const { id } = await params;
      const body = await req.json().catch(() => ({}));
      const proposal = await createPartsProposal(
        ctx,
        id,
        ctx.user.organisationId,
        Array.isArray(body?.lines) ? body.lines : undefined,
      );
      return Response.json(
        { proposal },
        { status: 200, headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
