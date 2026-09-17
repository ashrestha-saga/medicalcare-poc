import { destroySession } from "@/lib/auth/session";
import { clearTotpChallengeCookie } from "@/lib/auth/totpChallenge";

/** POST /api/auth/logout — clears the DeviceCare session cookie. */
export async function POST() {
  await clearTotpChallengeCookie();
  await destroySession();
  return Response.json({ ok: true });
}
