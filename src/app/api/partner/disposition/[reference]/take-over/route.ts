import {
  withTenantBypass,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { dispositionTakeOverSchema } from "@/schemas/console";
import { dispositionService } from "@/services/console/dispositionService";

type Ctx = { params: Promise<{ reference: string }> };

/** POST /api/partner/disposition/:reference/take-over — managing partner becomes executor. */
export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    const { reference } = await params;
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:disposition:assign");
      correlationId = ctx.correlationId;
      const raw = await req.json().catch(() => ({}));
      dispositionTakeOverSchema.parse(raw ?? {});
      const row = await dispositionService.takeOver(ctx, decodeURIComponent(reference));
      return Response.json({ row }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
