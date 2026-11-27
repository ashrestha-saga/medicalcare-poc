import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { inspectionReportService } from "@/services/reports/inspectionReportService";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/inspection-runs/:id/report — sealed protocol PDF (E106).
 * Clinic: inventory:view. Partner: only runs of the caller's own organisation.
 */
export async function GET(req: Request, ctxParams: RouteContext) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await ctxParams.params;
      const { bytes, filename, sha256 } = await inspectionReportService.getReportForDownload(ctx, id);
      return new Response(new Uint8Array(bytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${filename}"`,
          "Cache-Control": "private, max-age=3600",
          "X-Content-SHA256": sha256,
          "x-correlation-id": ctx.correlationId,
        },
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
