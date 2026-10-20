import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { setRoleDashboardTilesSchema } from "@/schemas/k10";
import { dashboardTileService } from "@/services/dashboard/dashboardTileService";
import type { UserRole } from "@/interfaces/session";
import { USER_ROLES } from "@/constants/roles";
import { badRequest } from "@/lib/errors";

export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const url = new URL(req.url);
      const role = url.searchParams.get("role");
      if (role) {
        if (!USER_ROLES.includes(role as UserRole)) throw badRequest("Unknown role");
        const assignment = await dashboardTileService.getRoleAssignment(ctx, role as UserRole);
        return Response.json({ assignment }, { headers: { "x-correlation-id": ctx.correlationId } });
      }
      const catalog = await dashboardTileService.listCatalog(ctx);
      return Response.json({ catalog }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

export async function PUT(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = setRoleDashboardTilesSchema.parse(await req.json().catch(() => ({})));
      const assignment = await dashboardTileService.setRoleTiles(ctx, input);
      return Response.json({ assignment }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
