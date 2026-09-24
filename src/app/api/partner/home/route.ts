import { requirePartnerContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { partnerHomeService } from "@/services/partner/partnerHomeService";

/** GET /api/partner/home — organisation people + contracted clinics (partner session). */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    correlationId = ctx.correlationId;
    const home = await partnerHomeService.getHome(ctx);
    return Response.json(home, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
