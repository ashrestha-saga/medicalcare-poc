import { cookies } from "next/headers";
import type { SessionUser } from "@/interfaces/session";
import { env } from "@/lib/env";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  buildSessionToken,
  decodeSessionToken,
} from "./sessionToken";

export { SESSION_COOKIE, decodeSessionToken as decodeSession };

/**
 * SEC-900 — the browser only ever holds this signed, httpOnly application
 * session. OXID tokens never leave the server (see lib/tokenStorage.ts).
 */
export async function createSession(user: SessionUser): Promise<void> {
  const token = buildSessionToken(user, env.session.secret, SESSION_TTL_SECONDS);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function readSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const payload = decodeSessionToken(store.get(SESSION_COOKIE)?.value, env.session.secret);
  return payload?.user ?? null;
}
