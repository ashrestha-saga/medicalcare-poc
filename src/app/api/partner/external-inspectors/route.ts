import {
  withTenantBypass,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { consoleExternalInviteSchema } from "@/schemas/console";
import { externalInspectorService } from "@/services/console/externalInspectorService";

/** GET /api/partner/external-inspectors */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:external:view");
      correlationId = ctx.correlationId;
      const data = await externalInspectorService.list(ctx);
      return Response.json(data, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** POST /api/partner/external-inspectors */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:external:manage");
      correlationId = ctx.correlationId;
      const input = consoleExternalInviteSchema.parse(await req.json());
      const invite = await externalInspectorService.invite(ctx, input, req);
      return Response.json({ invite }, { status: 201, headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
