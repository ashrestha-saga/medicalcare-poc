import { createHash, randomBytes } from "node:crypto";
import type { TenantContext } from "@/interfaces";
import { actorFromTenant } from "@/lib/auth/actorContext";
import { requirePermission } from "@/lib/auth/tenantContext";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { notFound, unprocessable } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import { resolveSmtp, type SmtpOwner } from "@/services/mail/resolveSmtp";
import nodemailer from "nodemailer";

const RESET_TTL_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

function appBaseUrl(): string {
  const raw =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

async function sendResetMail(args: {
  to: string;
  resetUrl: string;
  requesterName: string;
  owner: SmtpOwner;
}) {
  const resolved = await resolveSmtp(args.owner);
  if (!resolved.config) {
    logger.info("password_reset.email_simulated", {
      to: args.to,
      resetUrl: args.resetUrl,
      source: resolved.source,
      forcedSimulate: resolved.forcedSimulate,
    });
    return { simulated: true as const, source: resolved.source };
  }
  const smtp = resolved.config;
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });
  await transporter.sendMail({
    from: smtp.from,
    to: args.to,
    subject: "DeviceCare password reset",
    text: `${args.requesterName} triggered a password reset for your DeviceCare account.\n\nSet a new password:\n${args.resetUrl}\n\nThis link expires in 24 hours.`,
  });
  return { simulated: false as const, source: resolved.source };
}

export const passwordResetService = {
  /** Admin trigger — sends reset link to the user's work email (users:resetpassword). */
  async sendClinicReset(ctx: TenantContext, userId: string) {
    requirePermission(ctx, "users:resetpassword");
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: ctx.tenantId,
        accountKind: "clinic",
        NOT: { email: { startsWith: "staff-" } },
      },
      select: { id: true, email: true, active: true },
    });
    if (!user) throw notFound("User not found.");
    if (!user.active) throw unprocessable("Cannot reset password for an inactive account.");

    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, redeemedAt: null },
    });

    const token = newToken();
    const row = await prisma.passwordResetToken.create({
      data: {
        tenantId: ctx.tenantId,
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
        createdByUserId: ctx.user.id,
      },
    });

    const resetUrl = `${appBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    const mail = await sendResetMail({
      to: user.email,
      resetUrl,
      requesterName: ctx.user.name,
      owner: { tenantId: ctx.tenantId },
    });

    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "user",
      resourceId: user.id,
      action: "reset_password",
      summary: `Password reset link sent to ${user.email}`,
      after: { resetTokenId: row.id, emailSimulated: mail.simulated },
    });

    return {
      email: user.email,
      resetUrl,
      emailSimulated: mail.simulated,
    };
  },

  /** Public redeem — set new password from email link. */
  async redeem(input: { token: string; password: string }) {
    const token = input.token.trim();
    if (!token) throw unprocessable("Token is required.", { field: "token" });

    return runWithoutTenantAsync(async () => {
      const row = await prisma.passwordResetToken.findFirst({
        where: { tokenHash: hashToken(token), redeemedAt: null },
        include: { user: { select: { id: true, email: true, accountKind: true } } },
      });
      if (!row) throw notFound("Reset link not found or already used.");
      if (row.expiresAt.getTime() < Date.now()) {
        throw unprocessable("Reset link expired. Ask your administrator for a new one.");
      }

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: row.userId },
          data: {
            passwordHash: hashPassword(input.password),
            sessionsValidFrom: new Date(),
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        });
        await tx.passwordResetToken.update({
          where: { id: row.id },
          data: { redeemedAt: new Date() },
        });
      });

      return { accountKind: row.user.accountKind };
    });
  },
};
