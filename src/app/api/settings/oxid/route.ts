import { requirePermission, requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse, downstreamUnavailable } from "@/lib/errors";
import { hasPermission } from "@/constants/permissions";
import { oxidAuthService } from "@/services/oxid/oxidAuthService";
import { tenantOxidService } from "@/services/oxid/tenantOxidService";

/** GET /api/settings/oxid — public status of the tenant OXID link (any signed-in user). */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const status = await tenantOxidService.getPublicStatus(ctx.tenantId);
    return Response.json({
      ...status,
      canManage: hasPermission(ctx.user.role, "settings:oxid"),
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** POST /api/settings/oxid — superadmin starts OAuth to connect the tenant shop. */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    requirePermission(ctx, "settings:oxid");
    if (!oxidAuthService.isConfigured()) throw downstreamUnavailable("OXID is not configured on the server.");
    const authorizeUrl = oxidAuthService.beginTenantConnect({
      tenantId: ctx.tenantId,
      adminUserId: ctx.user.id,
      returnTo: "/settings",
    });
    return Response.json({ authorizeUrl });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** DELETE /api/settings/oxid — superadmin disconnects the tenant shop. */
export async function DELETE(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    requirePermission(ctx, "settings:oxid");
    const status = await tenantOxidService.disconnect(ctx.tenantId);
    return Response.json({ ...status, canManage: true });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
