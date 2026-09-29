import {
  withTenantBypass,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { createClinicSchema } from "@/schemas/console";
import { clinicOnboardService } from "@/services/console/clinicOnboardService";

/** GET /api/partner/clinics — contracted clinics for the signed-in organisation. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:customers:view");
      correlationId = ctx.correlationId;
      const list = await clinicOnboardService.list(ctx);
      return Response.json(list, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** POST /api/partner/clinics — create institution + tenant + site + contract. */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:customers:create");
      correlationId = ctx.correlationId;
      const input = createClinicSchema.parse(await req.json());
      const result = await clinicOnboardService.create(ctx, input);
      return Response.json(result, { status: 201, headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
