import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { passwordResetService } from "@/services/users/passwordResetService";

type Params = { params: Promise<{ id: string }> };

/** POST /api/users/[id]/reset-password — email reset link (users:resetpassword). */
export async function POST(req: Request, { params }: Params) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await params;
      const reset = await passwordResetService.sendClinicReset(ctx, id);
      return Response.json({ reset }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
