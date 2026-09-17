import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { resetUserPasswordSchema } from "@/schemas/user";
import { userAdminService } from "@/services/users/userAdminService";

type Params = { params: Promise<{ id: string }> };

/** POST /api/users/[id]/reset-password — admin reset (users:resetpassword). */
export async function POST(req: Request, { params }: Params) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const { id } = await params;
    const input = resetUserPasswordSchema.parse(await req.json());
    await userAdminService.resetPassword(ctx, id, input);
    return Response.json({ ok: true }, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
