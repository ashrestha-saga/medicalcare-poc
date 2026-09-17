import { createSession } from "@/lib/auth/session";
import { setTotpChallengeCookie } from "@/lib/auth/totpChallenge";
import { errorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { loginSchema } from "@/schemas/auth";
import { totpService } from "@/services/auth/totpService";
import { userAuthService } from "@/services/auth/userAuthService";

/** POST /api/auth/login — email/password; may require TOTP before session. */
export async function POST(req: Request) {
  try {
    const body = loginSchema.parse(await req.json());
    const { user, tenantName, totpEnabled } = await userAuthService.authenticate(
      body.email,
      body.password,
    );

    if (totpEnabled) {
      const { challengeId } = await totpService.createLoginChallenge(user.id);
      await setTotpChallengeCookie(user.id, user.tenantId, challengeId);
      logger.info("auth.login.requires_2fa", {
        userId: user.id,
        tenantId: user.tenantId,
        role: user.role,
      });
      return Response.json({
        requires2fa: true,
        message: "Enter the code from your authenticator app.",
      });
    }

    await createSession(user);
    logger.info("auth.login", { userId: user.id, tenantId: user.tenantId, role: user.role });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omit from response
    const { tenantId, ...publicUser } = user;
    return Response.json({ user: publicUser, tenantName });
  } catch (error) {
    return errorResponse(error);
  }
}
