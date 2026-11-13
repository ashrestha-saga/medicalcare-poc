import {
  requirePartnerContext,
  requirePartnerPermission,
  withTenantBypass,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { listPartsProposals } from "@/services/repairs/partsProposalService";

/** GET /api/partner/parts-proposals?status= */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:disposition:view");
      correlationId = ctx.correlationId;
      const status = new URL(req.url).searchParams.get("status") ?? undefined;
      const rows = await listPartsProposals(ctx, status ?? undefined);
      return Response.json(
        { proposals: rows },
        { headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
