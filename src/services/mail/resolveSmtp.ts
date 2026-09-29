import { env } from "@/lib/env";
import { decryptSecretOrPlain } from "@/lib/crypto/secretBox";
import { prisma } from "@/lib/prisma";
import { parseSmtpAuth, type SmtpAuthConfig } from "@/lib/smtp";

/** Clinic tenant or partner organisation — exactly one key. */
export type SmtpOwner = { tenantId: string; organisationId?: never } | { organisationId: string; tenantId?: never };

export type SmtpResolveSource = "target" | "owner" | "platform" | "none";

export type SmtpResolveResult = {
  config: SmtpAuthConfig | null;
  source: SmtpResolveSource;
  /** True when SMTP_DISABLE / test env forces no real send. */
  forcedSimulate: boolean;
};

function ownerWhere(owner: SmtpOwner) {
  if ("tenantId" in owner && owner.tenantId) {
    return { tenantId: owner.tenantId };
  }
  return { organisationId: owner.organisationId };
}

/** Load and decrypt SmtpSettings for an owner. */
export async function getSmtpForOwner(owner: SmtpOwner): Promise<SmtpAuthConfig | null> {
  const row = await prisma.smtpSettings.findFirst({ where: ownerWhere(owner) });
  if (!row) return null;
  let pass: string;
  try {
    pass = decryptSecretOrPlain(row.passEnc);
  } catch {
    return null;
  }
  return parseSmtpAuth({
    host: row.host,
    port: row.port,
    secure: row.secure,
    user: row.user,
    pass,
    from: row.fromAddr,
  });
}

/**
 * Resolve outbound SMTP:
 * 1. optional DispatchTarget.auth override
 * 2. SmtpSettings for owner
 * 3. platform env SMTP_*
 * SMTP_DISABLE / NODE_ENV=test → config null with forcedSimulate.
 */
export async function resolveSmtp(
  owner: SmtpOwner,
  targetAuth?: Record<string, unknown> | null,
): Promise<SmtpResolveResult> {
  const forcedSimulate = env.smtp.disabled;

  const fromTarget = parseSmtpAuth(targetAuth ?? null);
  if (fromTarget) {
    return {
      config: forcedSimulate ? null : fromTarget,
      source: "target",
      forcedSimulate,
    };
  }

  const fromOwner = await getSmtpForOwner(owner);
  if (fromOwner) {
    return {
      config: forcedSimulate ? null : fromOwner,
      source: "owner",
      forcedSimulate,
    };
  }

  const fromPlatform = env.smtp.asAuth;
  if (fromPlatform) {
    return {
      config: forcedSimulate ? null : fromPlatform,
      source: "platform",
      forcedSimulate,
    };
  }

  return { config: null, source: "none", forcedSimulate };
}
