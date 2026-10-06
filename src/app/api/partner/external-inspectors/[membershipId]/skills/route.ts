import {
  withTenantBypass,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { consoleStaffSkillCreateSchema } from "@/schemas/console";
import { externalInspectorService } from "@/services/console/externalInspectorService";

type Ctx = { params: Promise<{ membershipId: string }> };

/** POST /api/partner/external-inspectors/[membershipId]/skills */
export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    const { membershipId } = await params;
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:external:manage");
      correlationId = ctx.correlationId;
      const input = consoleStaffSkillCreateSchema.parse(await req.json());
      const member = await externalInspectorService.addSkill(ctx, membershipId, input);
      return Response.json(
        { member },
        { status: 201, headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
