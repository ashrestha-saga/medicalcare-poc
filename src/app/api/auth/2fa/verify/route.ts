import { createSession } from "@/lib/auth/session";
import {
  clearTotpChallengeCookie,
  readTotpChallengeCookie,
} from "@/lib/auth/totpChallenge";
import { errorResponse, unauthorized } from "@/lib/errors";
import { totpVerifySchema } from "@/schemas/auth";
import { totpService } from "@/services/auth/totpService";

/** POST /api/auth/2fa/verify — complete login after password + TOTP. */
export async function POST(req: Request) {
  try {
    const challenge = await readTotpChallengeCookie();
    if (!challenge) throw unauthorized("Two-factor challenge expired. Sign in again.");

    const body = totpVerifySchema.parse(await req.json());
    const { user, tenantName } = await totpService.verifyLoginChallenge({
      challengeId: challenge.challengeId,
      userId: challenge.user.id,
      code: body.code,
    });

    await clearTotpChallengeCookie();
    await createSession(user);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omit from response
    const { tenantId, ...publicUser } = user;
    return Response.json({ user: publicUser, tenantName });
  } catch (error) {
    return errorResponse(error);
  }
}
