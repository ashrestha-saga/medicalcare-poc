import { assertCron } from "@/lib/auth/cronAuth";
import { errorResponse } from "@/lib/errors";
import { runDispatchOutboxJob } from "@/services/jobs/dispatchOutboxJob";

/** POST /api/jobs/dispatch-outbox — OPS-02 retry worker (CRON_SECRET). */
export async function POST(req: Request) {
  try {
    assertCron(req);
    const result = await runDispatchOutboxJob();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
