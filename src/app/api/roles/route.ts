import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { roleGrantsService } from "@/services/roles/roleGrantsService";

/** GET /api/roles — role catalog from DB grants + user counts (roles:view). */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const [roles, allPermissions] = await Promise.all([
      roleGrantsService.listCatalog(ctx),
      roleGrantsService.listAllPermissionSlugs(ctx),
    ]);
    return Response.json(
      { roles, allPermissions },
      { headers: { "x-correlation-id": ctx.correlationId } },
    );
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
