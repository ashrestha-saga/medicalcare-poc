import {
  withTenantBypass,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { consoleTenantStaffAssignSchema } from "@/schemas/console";
import { clinicOnboardService } from "@/services/console/clinicOnboardService";
import { partnerStaffService } from "@/services/console/partnerStaffService";

type Ctx = { params: Promise<{ contractId: string }> };

/**
 * PUT /api/partner/clinics/[contractId]/staff
 * Assign or revoke one org staff membership on this clinic tenant.
 */
export async function PUT(req: Request, ctx: Ctx) {
  let correlationId: string | undefined;
  try {
    const partner = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(partner, "console:staff:assign");
      correlationId = partner.correlationId;
      const { contractId } = await ctx.params;
      const input = consoleTenantStaffAssignSchema.parse(await req.json());
      const clinic = await clinicOnboardService.getByContractId(partner, contractId);
      await partnerStaffService.setTenantAssignment(
        partner,
        clinic.tenantId,
        input.membershipId,
        input.assigned,
      );
      const updated = await clinicOnboardService.getByContractId(partner, contractId);
      return Response.json(
        { clinic: updated },
        { headers: { "x-correlation-id": partner.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
