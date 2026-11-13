import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { faultReportSchema } from "@/schemas/repairs";
import { reportFault } from "@/services/repairs/faultReportService";

/** POST /api/book-entries/fault — R9 fault report (repairs flag). */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = faultReportSchema.parse(await req.json().catch(() => ({})));
      const result = await reportFault(ctx, input);
      return Response.json(result, {
        status: 201,
        headers: { "x-correlation-id": ctx.correlationId },
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
