import { assertCron } from "@/lib/auth/cronAuth";
import { errorResponse } from "@/lib/errors";
import { inspectionReportService } from "@/services/reports/inspectionReportService";

/** POST /api/jobs/reports — render missing sealed-run PDFs (E106, CRON_SECRET). */
export async function POST(req: Request) {
  try {
    assertCron(req);
    const result = await inspectionReportService.runReportJob();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
