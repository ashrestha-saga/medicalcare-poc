/**
 * Manual / cron wrapper: process dispatch outbox.
 * Usage: npx tsx scripts/runDispatchOutbox.ts
 * Or call POST /api/jobs/dispatch-outbox with Authorization: Bearer $CRON_SECRET
 */
import { runDispatchOutboxJob } from "../src/services/jobs/dispatchOutboxJob";

runDispatchOutboxJob()
  .then((r) => {
    console.log(JSON.stringify({ ok: true, ...r }, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
