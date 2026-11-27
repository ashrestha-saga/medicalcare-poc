import { assertCron } from "@/lib/auth/cronAuth";
import { errorResponse } from "@/lib/errors";
import { runOrderIntentExpiryJob } from "@/services/jobs/orderIntentExpiryJob";

/** POST /api/jobs/orders/expire — CRON_SECRET. */
export async function POST(req: Request) {
  try {
    assertCron(req);
    const result = await runOrderIntentExpiryJob();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
