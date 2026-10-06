import {
  withTenantBypass,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { consoleStaffPatchSchema } from "@/schemas/console";
import { partnerStaffService } from "@/services/console/partnerStaffService";

type Ctx = { params: Promise<{ membershipId: string }> };

/** GET /api/partner/staff/[membershipId] */
export async function GET(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    const { membershipId } = await params;
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:staff:view");
      correlationId = ctx.correlationId;
      const member = await partnerStaffService.get(ctx, membershipId);
      return Response.json({ member }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** PATCH /api/partner/staff/[membershipId] */
export async function PATCH(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    const { membershipId } = await params;
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:staff:invite");
      correlationId = ctx.correlationId;
      const input = consoleStaffPatchSchema.parse(await req.json());
      const member = await partnerStaffService.update(ctx, membershipId, input);
      return Response.json({ member }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
