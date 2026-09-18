import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { userOptionsQuerySchema } from "@/schemas/userOptions";
import { userOptionsService } from "@/services/users/userOptionsService";

/**
 * GET /api/users/options?role(s)=device_admin&active=true&q=
 * Picklist for inventarize / inventory — not full users:view admin.
 */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const url = new URL(req.url);
    // Accept both `roles` and singular `role` for convenience.
    const rolesParam = url.searchParams.get("roles") ?? url.searchParams.get("role") ?? undefined;
    const parsed = userOptionsQuerySchema.parse({
      roles: rolesParam ?? undefined,
      active: url.searchParams.get("active") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      excludeIds: url.searchParams.get("excludeIds") ?? undefined,
    });
    const users = await userOptionsService.list(ctx, {
      roles: parsed.roles,
      active: parsed.active,
      q: parsed.q,
      excludeIds: parsed.excludeIds,
    });
    return Response.json({ users }, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
