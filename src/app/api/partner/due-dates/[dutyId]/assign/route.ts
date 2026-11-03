import {
  withTenantBypass,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { z } from "zod";
import { partnerDueDatesAssignService } from "@/services/console/partnerDueDatesAssignService";

type RouteContext = { params: Promise<{ dutyId: string }> };

const bodySchema = z.object({
  note: z.string().trim().max(2000).optional(),
});

/** POST /api/partner/due-dates/[dutyId]/assign — Version A self-dispatch. */
export async function POST(req: Request, ctx: RouteContext) {
  let correlationId: string | undefined;
  try {
    const partner = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(partner, "console:disposition:assign");
      correlationId = partner.correlationId;
      const { dutyId } = await ctx.params;
      const body = await req.json().catch(() => ({}));
      const input = bodySchema.parse(body ?? {});
      const result = await partnerDueDatesAssignService.assign(partner, dutyId, input);
      return Response.json(result, {
        status: result.created ? 201 : 200,
        headers: { "x-correlation-id": partner.correlationId },
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
