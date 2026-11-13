import { clinicHomePath } from "@/constants/authRoutes";
import { createSession } from "@/lib/auth/session";
import { setTotpChallengeCookie } from "@/lib/auth/totpChallenge";
import { errorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { loginSchema } from "@/schemas/auth";
import { totpService } from "@/services/auth/totpService";
import { userAuthService } from "@/services/auth/userAuthService";

/** POST /api/auth/login — email/password; may require TOTP before session (clinic + DEMO_SHARED_TOTP partner). */
export async function POST(req: Request) {
  try {
    const body = loginSchema.parse(await req.json());
    const door = body.door ?? "clinic";

    if (door === "partner") {
      const { user, organisationName, totpEnabled } = await userAuthService.authenticatePartner(
        body.email,
        body.password,
      );
      // DEMO_SHARED_TOTP: partner door challenges when bridge is active (or personal 2FA).
      if (totpEnabled) {
        const { challengeId } = await totpService.createLoginChallenge(user.id);
        await setTotpChallengeCookie(user.id, user.organisationId, challengeId);
        logger.info("auth.login.requires_2fa", {
          userId: user.id,
          organisationId: user.organisationId,
          appRole: user.appRole,
          door: "partner",
        });
        return Response.json({
          requires2fa: true,
          message: "Enter the code from your authenticator app.",
        });
      }
      await createSession(user);
      logger.info("auth.login.partner", {
        userId: user.id,
        organisationId: user.organisationId,
        appRole: user.appRole,
      });
      const { organisationId: _orgId, ...publicUser } = user;
      return Response.json({
        user: publicUser,
        tenantName: organisationName,
        homePath: "/partner",
      });
    }

    const { user, tenantName, totpEnabled } = await userAuthService.authenticate(
      body.email,
      body.password,
    );

    // totpEnabled also covers DEMO_SHARED_TOTP bridge (users without personal 2FA).
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
    const { tenantId: _tenantId, ...publicUser } = user;
    return Response.json({
      user: publicUser,
      tenantName,
      homePath: clinicHomePath(user.role),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
