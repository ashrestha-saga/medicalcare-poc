import { errorResponse } from "@/lib/errors";
import { redeemPasswordResetSchema } from "@/schemas/passwordReset";
import { passwordResetService } from "@/services/users/passwordResetService";

/** POST /api/auth/reset-password/redeem — set new password from email link. */
export async function POST(req: Request) {
  try {
    const input = redeemPasswordResetSchema.parse(await req.json());
    const result = await passwordResetService.redeem(input);
    return Response.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
