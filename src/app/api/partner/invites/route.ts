import {
  withTenantBypass,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { createPartnerInviteSchema } from "@/schemas/invite";
import { invitationService } from "@/services/users/invitationService";

/** POST /api/partner/invites — create partner user invitation. */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:staff:invite");
      correlationId = ctx.correlationId;
      const input = createPartnerInviteSchema.parse(await req.json());
      const invite = await invitationService.createPartnerInvite(ctx, input, req);
      return Response.json(
        { invite },
        { status: 201, headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
