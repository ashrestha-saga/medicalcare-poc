import type { SessionUser, TenantContext } from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import {
  TOTP_CHALLENGE_TTL_SECONDS,
  TOTP_MAX_ATTEMPTS,
} from "@/lib/auth/totpChallenge";
import {
  buildTotpUri,
  consumeBackupCode,
  createTotpSecret,
  decryptTotpSecret,
  encryptTotpSecret,
  generateBackupCodes,
  hashBackupCodes,
  verifyTotpCode,
} from "@/lib/auth/totp";
import { badRequest, conflict, unauthorized, unprocessable } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { toSessionUser } from "@/services/auth/userAuthService";
import QRCode from "qrcode";

export const totpService = {
  async createLoginChallenge(userId: string): Promise<{ challengeId: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + TOTP_CHALLENGE_TTL_SECONDS * 1000);
    await prisma.totpChallenge.deleteMany({
      where: { OR: [{ userId }, { expiresAt: { lt: new Date() } }] },
    });
    const row = await prisma.totpChallenge.create({
      data: { userId, expiresAt },
    });
    return { challengeId: row.id, expiresAt };
  },

  async verifyLoginChallenge(input: {
    challengeId: string;
    userId: string;
    code: string;
  }): Promise<{ user: SessionUser; tenantName: string }> {
    const challenge = await prisma.totpChallenge.findFirst({
      where: { id: input.challengeId, userId: input.userId },
    });
    if (!challenge || challenge.expiresAt.getTime() < Date.now()) {
      if (challenge) await prisma.totpChallenge.delete({ where: { id: challenge.id } }).catch(() => undefined);
      throw unauthorized("Two-factor challenge expired. Sign in again.");
    }
    if (challenge.attempts >= TOTP_MAX_ATTEMPTS) {
      await prisma.totpChallenge.delete({ where: { id: challenge.id } });
      throw unauthorized("Too many attempts. Sign in again.");
    }

    const row = await prisma.user.findFirst({
      where: { id: input.userId, active: true, totpEnabled: true },
      include: { tenant: { select: { name: true } } },
    });
    if (!row?.totpSecretEnc) {
      await prisma.totpChallenge.delete({ where: { id: challenge.id } });
      throw unauthorized("Two-factor authentication is not available.");
    }

    let ok = false;
    let remainingBackups: string[] | null = null;
    try {
      const secret = decryptTotpSecret(row.totpSecretEnc);
      ok = verifyTotpCode(secret, input.code);
    } catch {
      ok = false;
    }

    if (!ok) {
      remainingBackups = consumeBackupCode(row.totpBackupHashes, input.code);
      ok = remainingBackups !== null;
    }

    if (!ok) {
      await prisma.totpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      logger.warn("auth.2fa.fail", { userId: row.id, challengeId: challenge.id });
      throw unauthorized("Invalid authentication code.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.totpChallenge.delete({ where: { id: challenge.id } });
      if (remainingBackups) {
        await tx.user.update({
          where: { id: row.id },
          data: { totpBackupHashes: JSON.stringify(remainingBackups) },
        });
      }
    });

    logger.info("auth.2fa.success", { userId: row.id, usedBackup: Boolean(remainingBackups) });
    return { user: toSessionUser(row), tenantName: row.tenant.name };
  },

  async getStatus(ctx: TenantContext): Promise<{ enabled: boolean; verifiedAt: string | null }> {
    requirePermission(ctx, "account:security");
    const row = await prisma.user.findFirst({
      where: { id: ctx.user.id, tenantId: ctx.tenantId },
      select: { totpEnabled: true, totpVerifiedAt: true },
    });
    return {
      enabled: Boolean(row?.totpEnabled),
      verifiedAt: row?.totpVerifiedAt?.toISOString() ?? null,
    };
  },

  async startSetup(ctx: TenantContext): Promise<{
    otpauthUrl: string;
    secret: string;
    qrDataUrl: string;
  }> {
    requirePermission(ctx, "account:security");
    const row = await prisma.user.findFirst({
      where: { id: ctx.user.id, tenantId: ctx.tenantId, active: true },
    });
    if (!row) throw unauthorized();
    if (row.totpEnabled) throw conflict("Two-factor authentication is already enabled.");

    const secret = createTotpSecret();
    const otpauthUrl = buildTotpUri(secret, row.email);
    await prisma.user.update({
      where: { id: row.id },
      data: { totpPendingEnc: encryptTotpSecret(secret) },
    });
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 });
    return { otpauthUrl, secret, qrDataUrl };
  },

  async confirmSetup(ctx: TenantContext, code: string): Promise<{ backupCodes: string[] }> {
    requirePermission(ctx, "account:security");
    const row = await prisma.user.findFirst({
      where: { id: ctx.user.id, tenantId: ctx.tenantId, active: true },
    });
    if (!row?.totpPendingEnc) throw unprocessable("Start two-factor setup first.");
    if (row.totpEnabled) throw conflict("Two-factor authentication is already enabled.");

    let secret: string;
    try {
      secret = decryptTotpSecret(row.totpPendingEnc);
    } catch {
      throw badRequest("Invalid pending setup. Start again.");
    }
    if (!verifyTotpCode(secret, code)) {
      throw unauthorized("Invalid authentication code.");
    }

    const backupCodes = generateBackupCodes();
    await prisma.user.update({
      where: { id: row.id },
      data: {
        totpEnabled: true,
        totpSecretEnc: encryptTotpSecret(secret),
        totpPendingEnc: null,
        totpVerifiedAt: new Date(),
        totpBackupHashes: hashBackupCodes(backupCodes),
      },
    });
    logger.info("auth.2fa.enabled", { userId: row.id });
    return { backupCodes };
  },

  async cancelSetup(ctx: TenantContext): Promise<void> {
    requirePermission(ctx, "account:security");
    await prisma.user.updateMany({
      where: { id: ctx.user.id, tenantId: ctx.tenantId },
      data: { totpPendingEnc: null },
    });
  },

  async disable(
    ctx: TenantContext,
    input: { password: string; code: string },
  ): Promise<void> {
    requirePermission(ctx, "account:security");
    const row = await prisma.user.findFirst({
      where: { id: ctx.user.id, tenantId: ctx.tenantId, active: true },
    });
    if (!row) throw unauthorized();
    if (!row.totpEnabled || !row.totpSecretEnc) {
      throw conflict("Two-factor authentication is not enabled.");
    }
    if (!verifyPassword(input.password, row.passwordHash)) {
      throw unauthorized("Invalid password.");
    }

    let ok = false;
    try {
      ok = verifyTotpCode(decryptTotpSecret(row.totpSecretEnc), input.code);
    } catch {
      ok = false;
    }
    if (!ok) {
      const remaining = consumeBackupCode(row.totpBackupHashes, input.code);
      ok = remaining !== null;
    }
    if (!ok) throw unauthorized("Invalid authentication code.");

    await prisma.user.update({
      where: { id: row.id },
      data: {
        totpEnabled: false,
        totpSecretEnc: null,
        totpPendingEnc: null,
        totpVerifiedAt: null,
        totpBackupHashes: null,
      },
    });
    await prisma.totpChallenge.deleteMany({ where: { userId: row.id } });
    logger.info("auth.2fa.disabled", { userId: row.id });
  },

  /** Admin recovery — clears TOTP without code (users:resetpassword holders). */
  async adminReset(ctx: TenantContext, userId: string): Promise<void> {
    requirePermission(ctx, "users:resetpassword");
    const row = await prisma.user.findFirst({
      where: { id: userId, tenantId: ctx.tenantId },
    });
    if (!row) throw unauthorized("User not found.");
    await prisma.user.update({
      where: { id: row.id },
      data: {
        totpEnabled: false,
        totpSecretEnc: null,
        totpPendingEnc: null,
        totpVerifiedAt: null,
        totpBackupHashes: null,
      },
    });
    await prisma.totpChallenge.deleteMany({ where: { userId: row.id } });
    logger.info("auth.2fa.admin_reset", { userId: row.id, actorId: ctx.user.id });
  },
};
