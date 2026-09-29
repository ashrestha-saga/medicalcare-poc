import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { updateUserSchema } from "@/schemas/user";
import { userAdminService } from "@/services/users/userAdminService";

type Params = { params: Promise<{ id: string }> };

/** GET /api/users/[id] — user or pending invite (`invite:…`) (users:view). */
export async function GET(req: Request, { params }: Params) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await params;
      const user = await userAdminService.get(ctx, decodeURIComponent(id));
      return Response.json({ user }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** PATCH /api/users/[id] — update user (users:update). */
export async function PATCH(req: Request, { params }: Params) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await params;
      const input = updateUserSchema.parse(await req.json());
      const user = await userAdminService.update(ctx, id, input);
      return Response.json({ user }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** DELETE /api/users/[id] — delete user (users:delete). */
export async function DELETE(req: Request, { params }: Params) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await params;
      await userAdminService.remove(ctx, id);
      return Response.json({ ok: true }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
