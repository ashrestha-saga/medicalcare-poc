import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { invitationService } from "@/services/users/invitationService";

type Params = { params: Promise<{ id: string }> };

/** POST /api/users/invites/[id]/resend — rotate token and resend (users:create). */
export async function POST(req: Request, { params }: Params) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await params;
      const invite = await invitationService.resendClinicInvite(ctx, id);
      return Response.json({ invite }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
