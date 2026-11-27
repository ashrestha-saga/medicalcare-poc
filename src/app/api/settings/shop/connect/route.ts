import { requirePermission, requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { shopAuthService } from "@/services/shop/shopAuthService";

/** POST /api/settings/shop/connect — start PKCE OAuth for the tenant shop. */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      requirePermission(ctx, "settings:oxid");
      const body = (await req.json().catch(() => ({}))) as { returnTo?: string };
      const authorizeUrl = await shopAuthService.beginConnect({
        tenantId: ctx.tenantId,
        adminUserId: ctx.user.id,
        returnTo: typeof body.returnTo === "string" ? body.returnTo : "/settings",
      });
      return Response.json({ authorizeUrl });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
