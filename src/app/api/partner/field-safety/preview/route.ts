import {
  withTenantBypass,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { fieldSafetyPreviewQuerySchema } from "@/schemas/console";
import { fieldSafetyRolloutService } from "@/services/console/fieldSafetyRolloutService";

/** GET /api/partner/field-safety/preview?modelLabel=&manufacturer= — affected tenants. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "fieldsafety:rollout");
      correlationId = ctx.correlationId;
      const url = new URL(req.url);
      const input = fieldSafetyPreviewQuerySchema.parse({
        modelLabel: url.searchParams.get("modelLabel") ?? "",
        manufacturer: url.searchParams.get("manufacturer") || undefined,
      });
      const data = await fieldSafetyRolloutService.preview(ctx, input);
      return Response.json(data, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
