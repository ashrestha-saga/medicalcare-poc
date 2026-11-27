import { requirePermission, requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse, downstreamUnavailable } from "@/lib/errors";
import { shopAuthService } from "@/services/shop/shopAuthService";
import { shopConnectionService } from "@/services/shop/shopConnectionService";

/**
 * Legacy path — prefer /api/settings/shop.
 * GET: tenant shop link status. POST: begins shop connect (settings:oxid).
 */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const status = await shopConnectionService.getPublicStatus(ctx.tenantId);
      const token = await shopAuthService.getAccessTokenForTenant(ctx.tenantId);
      return Response.json({
        configured: status.configured,
        connected: Boolean(token),
        status: status.status,
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      requirePermission(ctx, "settings:oxid");
      const cfg = await shopConnectionService.getConfig(ctx.tenantId);
      if (!cfg) throw downstreamUnavailable("Shop is not configured for this tenant.");
      const body = (await req.json().catch(() => ({}))) as { returnTo?: string };
      const returnTo = typeof body.returnTo === "string" && body.returnTo.startsWith("/") ? body.returnTo : "/settings";
      const authorizeUrl = await shopAuthService.beginConnect({
        tenantId: ctx.tenantId,
        adminUserId: ctx.user.id,
        returnTo,
      });
      return Response.json({ authorizeUrl });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
