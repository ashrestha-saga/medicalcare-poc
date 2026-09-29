import { errorResponse } from "@/lib/errors";
import { redeemInviteSchema } from "@/schemas/invite";
import { invitationService } from "@/services/users/invitationService";

/** POST /api/auth/invite/redeem — accept invitation and set password. */
export async function POST(req: Request) {
  try {
    const input = redeemInviteSchema.parse(await req.json());
    const result = await invitationService.redeem(input);
    return Response.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
