import { requirePermission, requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { hasPermission } from "@/constants/permissions";
import { actorFromContext } from "@/lib/auth/actorContext";
import { shopAuthService } from "@/services/shop/shopAuthService";
import { shopConnectionService } from "@/services/shop/shopConnectionService";

/** GET /api/settings/oxid — shim to shop connection status. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const canManage = hasPermission(ctx.user.role, "settings:oxid");
      const status = await shopConnectionService.getPublicStatus(ctx.tenantId, canManage);
      return Response.json({
        configured: status.configured,
        status: status.status,
        customerNumber: status.customerNumber,
        companyName: status.companyName,
        shopBaseUrl: status.shopBaseUrl,
        connectedAt: status.connectedAt,
        lastError: status.lastError,
        canManage: status.canManage,
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** POST /api/settings/oxid — start shop OAuth connect. */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      requirePermission(ctx, "settings:oxid");
      const authorizeUrl = await shopAuthService.beginConnect({
        tenantId: ctx.tenantId,
        adminUserId: ctx.user.id,
        returnTo: "/settings",
      });
      return Response.json({ authorizeUrl });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** DELETE /api/settings/oxid — disconnect shop tokens. */
export async function DELETE(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      requirePermission(ctx, "settings:oxid");
      const status = await shopConnectionService.disconnect(ctx.tenantId, actorFromContext(ctx));
      return Response.json({
        configured: status.configured,
        status: status.status,
        customerNumber: status.customerNumber,
        companyName: status.companyName,
        shopBaseUrl: status.shopBaseUrl,
        connectedAt: status.connectedAt,
        lastError: status.lastError,
        canManage: true,
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
