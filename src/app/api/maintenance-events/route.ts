import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { externalRepairSchema } from "@/schemas/repairs";
import { createExternalRepairReport } from "@/services/repairs/externalReportService";

/** POST /api/maintenance-events — R17 external repair report. */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = externalRepairSchema.parse(await req.json().catch(() => ({})));
      const result = await createExternalRepairReport(ctx, input);
      return Response.json(result, {
        status: 201,
        headers: { "x-correlation-id": ctx.correlationId },
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
