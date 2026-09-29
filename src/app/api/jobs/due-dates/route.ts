import { assertCron } from "@/lib/auth/cronAuth";
import { errorResponse } from "@/lib/errors";
import { runDueDateReminderJob } from "@/services/jobs/dueDateReminderJob";

/** POST /api/jobs/due-dates — OPS-01 deadline reminder run (CRON_SECRET). */
export async function POST(req: Request) {
  try {
    assertCron(req);
    const result = await runDueDateReminderJob();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
