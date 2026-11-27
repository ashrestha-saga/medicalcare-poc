import { requireActingContext, requirePermission, withTenantStore } from "@/lib/auth/tenantContext";
import { downstreamUnavailable, errorResponse } from "@/lib/errors";
import { shopAuthService } from "@/services/shop/shopAuthService";
import { shopConnectionService } from "@/services/shop/shopConnectionService";
import { getShopProvider } from "@/services/shop/shopRegistry";

/** GET /api/shop/account — shop profile (/me) including delivery addresses. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      requirePermission(ctx, "parts:request");
      const session = await shopAuthService.getSession(ctx.tenantId);
      if (!session) throw downstreamUnavailable("Shop is not connected. Configure it in Settings.");
      const provider = getShopProvider(await shopConnectionService.getProviderType(ctx.tenantId));
      const account = await provider.auth.fetchAccount(session);
      // Keep stored hasSubUsers in sync with live profile.
      await shopConnectionService.updateHasSubUsers(ctx.tenantId, account.hasSubUsers);
      return Response.json(
        {
          id: account.id,
          displayName: account.displayName ?? null,
          companyName: account.companyName ?? null,
          customerNumber: account.customerNumber ?? null,
          hasSubUsers: account.hasSubUsers,
          deliveryAddresses: account.deliveryAddresses.map((a) => ({ id: a.id, label: a.label })),
        },
        { headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
