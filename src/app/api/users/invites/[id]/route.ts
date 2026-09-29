import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { invitationService } from "@/services/users/invitationService";

type Params = { params: Promise<{ id: string }> };

/** DELETE /api/users/invites/[id] — withdraw pending invitation (users:delete). */
export async function DELETE(req: Request, { params }: Params) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await params;
      await invitationService.withdrawClinicInvite(ctx, id);
      return Response.json({ ok: true }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
