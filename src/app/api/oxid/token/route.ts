import { requirePermission, requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse, downstreamUnavailable } from "@/lib/errors";
import { oxidAuthService } from "@/services/oxid/oxidAuthService";
import { tenantOxidService } from "@/services/oxid/tenantOxidService";

/**
 * Legacy path — prefer /api/settings/oxid.
 * GET: tenant OXID link status. POST: begins tenant connect (settings:oxid).
 */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const status = await tenantOxidService.getPublicStatus(ctx.tenantId);
    const token = await oxidAuthService.getAccessTokenForTenant(ctx.tenantId);
    return Response.json({
      configured: status.configured,
      connected: Boolean(token),
      status: status.status,
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    requirePermission(ctx, "settings:oxid");
    if (!oxidAuthService.isConfigured()) throw downstreamUnavailable("OXID is not configured on the server.");
    const body = (await req.json().catch(() => ({}))) as { returnTo?: string };
    const returnTo = typeof body.returnTo === "string" && body.returnTo.startsWith("/") ? body.returnTo : "/settings";
    return Response.json({
      authorizeUrl: oxidAuthService.beginTenantConnect({
        tenantId: ctx.tenantId,
        adminUserId: ctx.user.id,
        returnTo,
      }),
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
