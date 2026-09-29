import { cookies } from "next/headers";
import type { SessionUser } from "@/interfaces/session";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
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

/**
 * Read and validate the session cookie.
 * SEC-03: rejects cookies issued before User.sessionsValidFrom, and inactive users.
 */
export async function readSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const payload = decodeSessionToken(store.get(SESSION_COOKIE)?.value, env.session.secret);
  if (!payload?.user?.id) return null;

  const row = await prisma.user.findFirst({
    where: { id: payload.user.id },
    select: { active: true, sessionsValidFrom: true },
  });
  if (!row || !row.active) return null;
  if (row.sessionsValidFrom) {
    const iatMs = payload.iat * 1000;
    if (iatMs < row.sessionsValidFrom.getTime()) return null;
  }
  return payload.user;
}
