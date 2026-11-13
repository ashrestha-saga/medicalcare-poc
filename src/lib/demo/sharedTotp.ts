/**
 * DEMO_SHARED_TOTP — demo showcase shared authenticator bridge.
 *
 * One TOTP secret covers every clinic and partner user who has NOT enabled
 * personal 2FA. Once a clinic user completes /security enrollment, only their
 * secret is accepted. Partner door uses the same shared secret when the bridge
 * is on (partners have no personal 2FA UI today).
 *
 * Removal: see docs/DEMO_SHARED_TOTP.md (search the repo for DEMO_SHARED_TOTP).
 * Allowed in production when explicitly enabled (hosted demo). Off in Vitest.
 */

import { env } from "@/lib/env";
import { buildTotpUri, verifyTotpCode } from "@/lib/auth/totp";

const BRIDGE_LABEL = "demo-bridge";

/**
 * True when the shared bridge may run.
 * Requires DEMO_SHARED_TOTP_ENABLED=true and a non-empty secret.
 * Disabled in Vitest (`NODE_ENV=test`) so unit/integration tests stay hermetic.
 */
export function isDemoSharedTotpActive(): boolean {
  if (env.nodeEnv === "test") return false;
  if (!env.demoSharedTotp.enabled) return false;
  return Boolean(env.demoSharedTotp.secret);
}

export function demoSharedTotpSecret(): string | null {
  if (!isDemoSharedTotpActive()) return null;
  return env.demoSharedTotp.secret || null;
}

/** otpauth URI for the presenter’s single Authenticator entry. */
export function demoSharedTotpUri(): string | null {
  const secret = demoSharedTotpSecret();
  if (!secret) return null;
  return buildTotpUri(secret, BRIDGE_LABEL, env.demoSharedTotp.issuer);
}

export function verifyDemoSharedTotpCode(code: string): boolean {
  const secret = demoSharedTotpSecret();
  if (!secret) return false;
  return verifyTotpCode(secret, code);
}

/** Optional page/API gate when DEMO_BRIDGE_PASS is set. */
export function demoBridgePassOk(provided: string | null | undefined): boolean {
  const expected = env.demoSharedTotp.bridgePass;
  if (!expected) return true;
  return Boolean(provided && provided === expected);
}

export function clinicUserUsesPersonalTotp(row: {
  totpEnabled: boolean | null | undefined;
  totpSecretEnc: string | null | undefined;
}): boolean {
  return Boolean(row.totpEnabled && row.totpSecretEnc);
}

/** After password OK: challenge if personal 2FA or demo bridge is active. */
export function clinicLoginRequires2fa(row: {
  totpEnabled: boolean | null | undefined;
  totpSecretEnc: string | null | undefined;
}): boolean {
  return clinicUserUsesPersonalTotp(row) || isDemoSharedTotpActive();
}

/** Alias — same rule for partner door when DEMO_SHARED_TOTP is on. */
export const loginRequires2fa = clinicLoginRequires2fa;
