import { assertCron } from "@/lib/auth/cronAuth";
import { errorResponse } from "@/lib/errors";
import { runOrderStatusPollJob } from "@/services/jobs/orderStatusPollJob";

/** POST /api/jobs/orders/poll — CRON_SECRET. */
export async function POST(req: Request) {
  try {
    assertCron(req);
    const result = await runOrderStatusPollJob();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
