import {
  withTenantBypass,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { externalInspectorService } from "@/services/console/externalInspectorService";

type Ctx = { params: Promise<{ membershipId: string; qualificationId: string }> };

/** DELETE /api/partner/external-inspectors/[membershipId]/qualifications/[qualificationId] */
export async function DELETE(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    const { membershipId, qualificationId } = await params;
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:external:manage");
      correlationId = ctx.correlationId;
      const member = await externalInspectorService.removeQualification(
        ctx,
        membershipId,
        qualificationId,
      );
      return Response.json({ member }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
