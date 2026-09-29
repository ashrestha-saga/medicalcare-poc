import {
  withTenantBypass,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { updateClinicContractSchema } from "@/schemas/console";
import { clinicOnboardService } from "@/services/console/clinicOnboardService";

type Ctx = { params: Promise<{ contractId: string }> };

/** GET /api/partner/clinics/[contractId] */
export async function GET(req: Request, ctx: Ctx) {
  let correlationId: string | undefined;
  try {
    const partner = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(partner, "console:customers:view");
      correlationId = partner.correlationId;
      const { contractId } = await ctx.params;
      const clinic = await clinicOnboardService.getByContractId(partner, contractId);
      return Response.json({ clinic }, { headers: { "x-correlation-id": partner.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** PATCH /api/partner/clinics/[contractId] — update contract fields. */
export async function PATCH(req: Request, ctx: Ctx) {
  let correlationId: string | undefined;
  try {
    const partner = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(partner, "console:contracts:update");
      correlationId = partner.correlationId;
      const { contractId } = await ctx.params;
      const input = updateClinicContractSchema.parse(await req.json());
      const clinic = await clinicOnboardService.updateContract(partner, contractId, input);
      return Response.json({ clinic }, { headers: { "x-correlation-id": partner.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
