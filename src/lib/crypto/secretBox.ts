import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

function deriveAesKey(material: string): Buffer {
  return createHash("sha256").update(material).digest();
}

/** Encrypt a secret for DB storage (`v1.<iv>.<tag>.<ciphertext>` hex). */
export function encryptSecret(plain: string, keyMaterial = env.totp.encryptionKey): string {
  const key = deriveAesKey(keyMaterial);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("hex")}.${tag.toString("hex")}.${enc.toString("hex")}`;
}

export function decryptSecret(payload: string, keyMaterial = env.totp.encryptionKey): string {
  const [version, ivHex, tagHex, dataHex] = payload.split(".");
  if (version !== "v1" || !ivHex || !tagHex || !dataHex) {
    throw new Error("Invalid encrypted secret payload.");
  }
  const key = deriveAesKey(keyMaterial);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

/** True when the string looks like our v1 secret-box format. */
export function isSecretBoxPayload(value: string): boolean {
  const parts = value.split(".");
  return parts.length === 4 && parts[0] === "v1" && parts.every((p) => p.length > 0);
}

/**
 * Decrypt a stored token. During rollout, plaintext values (pre-encryption) are returned as-is.
 */
export function decryptSecretOrPlain(value: string, keyMaterial = env.totp.encryptionKey): string {
  if (isSecretBoxPayload(value)) return decryptSecret(value, keyMaterial);
  return value;
}
