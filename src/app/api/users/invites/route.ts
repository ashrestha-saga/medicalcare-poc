import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { createClinicInviteSchema } from "@/schemas/invite";
import { invitationService } from "@/services/users/invitationService";

/** POST /api/users/invites — create clinic user invitation (users:create). */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = createClinicInviteSchema.parse(await req.json());
      const invite = await invitationService.createClinicInvite(ctx, input);
      return Response.json(
        { invite },
        { status: 201, headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
