import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { hmacHex, safeEqual } from "@/lib/crypto";

export const TOTP_CHALLENGE_COOKIE = "devicecare_totp_challenge";
export const TOTP_CHALLENGE_TTL_SECONDS = 5 * 60;
export const TOTP_MAX_ATTEMPTS = 5;

export interface TotpChallengePayload {
  user: { id: string; tenantId: string };
  challengeId: string;
  iat: number;
  exp: number;
}

export function encodeTotpChallenge(
  payload: TotpChallengePayload,
  secret = env.session.secret,
): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = hmacHex(secret, body);
  return `${body}.${sig}`;
}

export function decodeTotpChallenge(
  token: string | undefined,
  secret = env.session.secret,
): TotpChallengePayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = hmacHex(secret, body);
  if (!safeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TotpChallengePayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
    if (!payload.user?.id || !payload.challengeId) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setTotpChallengeCookie(
  userId: string,
  tenantId: string,
  challengeId: string,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const token = encodeTotpChallenge({
    user: { id: userId, tenantId },
    challengeId,
    iat: now,
    exp: now + TOTP_CHALLENGE_TTL_SECONDS,
  });
  const store = await cookies();
  store.set(TOTP_CHALLENGE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: TOTP_CHALLENGE_TTL_SECONDS,
  });
}

export async function clearTotpChallengeCookie(): Promise<void> {
  const store = await cookies();
  store.delete(TOTP_CHALLENGE_COOKIE);
}

export async function readTotpChallengeCookie(): Promise<TotpChallengePayload | null> {
  const store = await cookies();
  return decodeTotpChallenge(store.get(TOTP_CHALLENGE_COOKIE)?.value);
}
