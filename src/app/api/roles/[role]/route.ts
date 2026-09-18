import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse, notFound } from "@/lib/errors";
import { roleSlugSchema, updateRoleGrantsSchema } from "@/schemas/roleGrants";
import { roleGrantsService } from "@/services/roles/roleGrantsService";

type RouteContext = { params: Promise<{ role: string }> };

/** PATCH /api/roles/[role] — replace permission grants (roles:update). */
export async function PATCH(req: Request, ctx: RouteContext) {
  let correlationId: string | undefined;
  try {
    const auth = await requireTenantContext(req);
    correlationId = auth.correlationId;
    const { role: raw } = await ctx.params;
    const roleParsed = roleSlugSchema.safeParse(raw);
    if (!roleParsed.success) throw notFound("Role not found.");
    const input = updateRoleGrantsSchema.parse(await req.json());
    const updated = await roleGrantsService.updateRole(auth, roleParsed.data, input.permissions);
    return Response.json({ role: updated }, { headers: { "x-correlation-id": auth.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
