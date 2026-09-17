import type { SessionUser } from "@/interfaces/session";
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/constants/session";
import { hmacHex, safeEqual } from "@/lib/crypto";

export { SESSION_COOKIE, SESSION_TTL_SECONDS };

export interface SessionPayload {
  user: SessionUser;
  iat: number;
  exp: number;
}

/** Pure cookie token helpers — safe to import from Playwright (no next/headers). */
export function encodeSessionPayload(payload: SessionPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = hmacHex(secret, body);
  return `${body}.${sig}`;
}

export function buildSessionToken(user: SessionUser, secret: string, ttlSeconds = SESSION_TTL_SECONDS): string {
  const now = Math.floor(Date.now() / 1000);
  return encodeSessionPayload({ user, iat: now, exp: now + ttlSeconds }, secret);
}

export function decodeSessionToken(token: string | undefined, secret: string): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = hmacHex(secret, body);
  if (!safeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
    if (!payload.user?.id || !payload.user?.tenantId) return null;
    return payload;
  } catch {
    return null;
  }
}
