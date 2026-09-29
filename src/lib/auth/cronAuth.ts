import { env } from "@/lib/env";
import { unauthorized } from "@/lib/errors";

/** Assert cron caller — `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret`. */
export function assertCron(req: Request): void {
  const secret = env.cron.secret;
  if (!secret) {
    if (env.isProduction) throw unauthorized("CRON_SECRET is not configured.");
    // Dev without secret: allow only when explicitly empty is not production.
    return;
  }
  const bearer = req.headers.get("authorization");
  const header = req.headers.get("x-cron-secret");
  const token =
    bearer?.toLowerCase().startsWith("bearer ") ? bearer.slice(7).trim() : header?.trim() ?? "";
  if (!token || token !== secret) throw unauthorized("Invalid cron credentials.");
}
