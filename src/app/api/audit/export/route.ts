import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { auditListQuerySchema } from "@/schemas/audit";
import { auditService } from "@/services/audit/auditService";

/** GET /api/audit/export — CSV (default) or JSON dump (audit:export). */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const url = new URL(req.url);
      const query = auditListQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
      if (query.format === "json") {
        const result = await auditService.list(ctx, { ...query, limit: 200 });
        return Response.json(result, { headers: { "x-correlation-id": ctx.correlationId } });
      }
      const csv = await auditService.exportCsv(ctx, query);
      return new Response(csv, {
        headers: {
          "x-correlation-id": ctx.correlationId,
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="activity.csv"' } });
    });
  } catch (error) {
      return errorResponse(error, correlationId);
  }
}

