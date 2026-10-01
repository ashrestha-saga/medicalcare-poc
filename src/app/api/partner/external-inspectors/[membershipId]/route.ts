import {
  withTenantBypass,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { consoleExternalUpdateSchema } from "@/schemas/console";
import { externalInspectorService } from "@/services/console/externalInspectorService";

type Ctx = { params: Promise<{ membershipId: string }> };

/** GET /api/partner/external-inspectors/[membershipId] */
export async function GET(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    const { membershipId } = await params;
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:external:view");
      correlationId = ctx.correlationId;
      const member = await externalInspectorService.get(ctx, membershipId);
      return Response.json({ member }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** PATCH /api/partner/external-inspectors/[membershipId] */
export async function PATCH(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    const { membershipId } = await params;
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:external:manage");
      correlationId = ctx.correlationId;
      const input = consoleExternalUpdateSchema.parse(await req.json());
      const member = await externalInspectorService.update(ctx, membershipId, input);
      return Response.json({ member }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
