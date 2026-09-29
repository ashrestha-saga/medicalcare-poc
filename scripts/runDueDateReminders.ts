/**
 * Manual / cron wrapper: run due-date reminder job.
 * Usage: CRON_SECRET=… npx tsx scripts/runDueDateReminders.ts
 * Or call POST /api/jobs/due-dates with Authorization: Bearer $CRON_SECRET
 */
import { runDueDateReminderJob } from "../src/services/jobs/dueDateReminderJob";

runDueDateReminderJob()
  .then((r) => {
    console.log(JSON.stringify({ ok: true, ...r }, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
