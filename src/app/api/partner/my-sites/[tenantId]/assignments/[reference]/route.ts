import {
  withTenantBypass,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { dispositionAssignSchema } from "@/schemas/console";
import { dispositionService } from "@/services/console/dispositionService";

type Ctx = { params: Promise<{ tenantId: string; reference: string }> };

/**
 * PATCH /api/partner/my-sites/[tenantId]/assignments/[reference]
 * Own rows, or unassigned rows claimed by an admin.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    const { reference } = await params;
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:disposition:assign");
      correlationId = ctx.correlationId;
      const input = dispositionAssignSchema.parse(await req.json());
      const row = await dispositionService.assignFromPortal(
        ctx,
        decodeURIComponent(reference),
        input,
      );
      return Response.json({ row }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
