import { requirePermission, requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { hasPermission } from "@/constants/permissions";
import { actorFromContext } from "@/lib/auth/actorContext";
import { errorResponse } from "@/lib/errors";
import { upsertShopConnectionSchema } from "@/schemas/shop";
import { shopConnectionService } from "@/services/shop/shopConnectionService";

/** GET /api/settings/shop — public shop connection status. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const canManage = hasPermission(ctx.user.role, "settings:oxid");
      const status = await shopConnectionService.getPublicStatus(ctx.tenantId, canManage);
      return Response.json(status);
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** PUT /api/settings/shop — save per-tenant shop credentials. */
export async function PUT(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      requirePermission(ctx, "settings:oxid");
      const input = upsertShopConnectionSchema.parse(await req.json());
      const status = await shopConnectionService.upsertConfig(ctx.tenantId, input, actorFromContext(ctx));
      return Response.json(status);
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** DELETE /api/settings/shop — disconnect tokens (keeps credentials). */
export async function DELETE(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      requirePermission(ctx, "settings:oxid");
      const status = await shopConnectionService.disconnect(ctx.tenantId, actorFromContext(ctx));
      return Response.json({ ...status, canManage: true });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
