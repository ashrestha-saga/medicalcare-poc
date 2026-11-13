import {
  requirePartnerContext,
  requirePartnerPermission,
  withTenantBypass,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { proposeFollowUpSchema } from "@/schemas/pruefpartner";
import { inspectFollowUpService } from "@/services/pruefpartner/inspectFollowUpService";

type Ctx = { params: Promise<{ reference: string }> };

/** POST /api/partner/disposition/[reference]/follow-up — D3 proposal fields. */
export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:disposition:assign", "inspection:propose");
      correlationId = ctx.correlationId;
      const { reference } = await params;
      const input = proposeFollowUpSchema.parse(await req.json().catch(() => ({})));
      const result = await inspectFollowUpService.propose(ctx, reference, input);
      return Response.json(result, {
        status: 201,
        headers: { "x-correlation-id": ctx.correlationId },
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
