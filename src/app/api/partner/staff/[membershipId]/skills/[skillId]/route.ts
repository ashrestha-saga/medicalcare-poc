import {
  withTenantBypass,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { partnerStaffService } from "@/services/console/partnerStaffService";

type Ctx = { params: Promise<{ membershipId: string; skillId: string }> };

/** DELETE /api/partner/staff/[membershipId]/skills/[skillId] */
export async function DELETE(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    const { membershipId, skillId } = await params;
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:staff:invite");
      correlationId = ctx.correlationId;
      const member = await partnerStaffService.removeSkill(ctx, membershipId, skillId);
      return Response.json({ member }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
