import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { generateSecret, generateSync, generateURI, verifySync } from "otplib";
import { env } from "@/lib/env";
import { hashPassword, verifyPassword } from "@/lib/password";

const TOTP_EPOCH_TOLERANCE_SEC = 30;
const BACKUP_CODE_COUNT = 10;

function deriveAesKey(material: string): Buffer {
  return createHash("sha256").update(material).digest();
}

/** Encrypt a TOTP secret for DB storage (`v1.<iv>.<tag>.<ciphertext>` hex). */
export function encryptTotpSecret(plain: string, keyMaterial = env.totp.encryptionKey): string {
  const key = deriveAesKey(keyMaterial);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("hex")}.${tag.toString("hex")}.${enc.toString("hex")}`;
}

export function decryptTotpSecret(payload: string, keyMaterial = env.totp.encryptionKey): string {
  const [version, ivHex, tagHex, dataHex] = payload.split(".");
  if (version !== "v1" || !ivHex || !tagHex || !dataHex) {
    throw new Error("Invalid TOTP secret payload.");
  }
  const key = deriveAesKey(keyMaterial);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

export function createTotpSecret(): string {
  return generateSecret();
}

export function buildTotpUri(secret: string, email: string, issuer = env.totp.issuer): string {
  return generateURI({
    issuer,
    label: email,
    secret,
  });
}

export function verifyTotpCode(secret: string, token: string): boolean {
  const cleaned = token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  const result = verifySync({
    secret,
    token: cleaned,
    epochTolerance: TOTP_EPOCH_TOLERANCE_SEC,
  });
  return Boolean(result.valid);
}

/** Dev/test helper — current TOTP for a secret. */
export function currentTotpCode(secret: string): string {
  return generateSync({ secret });
}

export function generateBackupCodes(count = BACKUP_CODE_COUNT): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = randomBytes(5).toString("hex").toUpperCase();
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

export function hashBackupCodes(codes: string[]): string {
  return JSON.stringify(codes.map((c) => hashPassword(normalizeBackupCode(c))));
}

export function parseBackupHashes(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function normalizeBackupCode(code: string): string {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

/**
 * Returns remaining hashes if `code` matched one entry; null if no match.
 */
export function consumeBackupCode(
  hashesJson: string | null | undefined,
  code: string,
): string[] | null {
  const hashes = parseBackupHashes(hashesJson);
  const normalized = normalizeBackupCode(code);
  if (!normalized) return null;
  const idx = hashes.findIndex((h) => verifyPassword(normalized, h));
  if (idx < 0) return null;
  return hashes.filter((_, i) => i !== idx);
}

export { BACKUP_CODE_COUNT };
