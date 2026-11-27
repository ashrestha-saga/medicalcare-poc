import { assertCron } from "@/lib/auth/cronAuth";
import { errorResponse } from "@/lib/errors";
import { runNotificationDigestJob } from "@/services/jobs/notificationDigestJob";

/** POST /api/jobs/notification-digest — daily mail digest stub (E107, CRON_SECRET). */
export async function POST(req: Request) {
  try {
    assertCron(req);
    const result = await runNotificationDigestJob();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
