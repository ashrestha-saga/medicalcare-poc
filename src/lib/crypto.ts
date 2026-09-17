import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hmacHex(secret: string, input: string): string {
  return createHmac("sha256", secret).update(input).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function newCorrelationId(): string {
  return randomUUID();
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Section 30 — identifiers are logged only as hashes. */
export function hashIdentifier(identifier: string): string {
  return sha256Hex(identifier.trim().toUpperCase()).slice(0, 32);
}

/**
 * Stable canonical JSON for fingerprints: sorted keys, undefined dropped.
 * Used to detect an idempotency key reused with a different body (23.1).
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = sortKeys(v);
    }
    return out;
  }
  return value;
}

export function fingerprint(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

/** Human-friendly, sortable reference like SR-20260910-4F7A2C. */
export function newReference(prefix: "SR" | "OR"): string {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `${prefix}-${ymd}-${randomBytes(3).toString("hex").toUpperCase()}`;
}
