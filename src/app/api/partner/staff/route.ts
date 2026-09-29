import {
  withTenantBypass,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { consoleStaffInviteSchema } from "@/schemas/console";
import { partnerStaffService } from "@/services/console/partnerStaffService";

/** GET /api/partner/staff */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:staff:view");
      correlationId = ctx.correlationId;
      const data = await partnerStaffService.list(ctx);
      return Response.json(data, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** POST /api/partner/staff — invite partner user. */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:staff:invite");
      correlationId = ctx.correlationId;
      const input = consoleStaffInviteSchema.parse(await req.json());
      const invite = await partnerStaffService.invite(ctx, input, req);
      return Response.json({ invite }, { status: 201, headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
