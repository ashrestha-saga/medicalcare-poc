import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { triageResolveSchema } from "@/schemas/repairs";
import { resolveMalfunctionTriage } from "@/services/repairs/faultReportService";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/clarifications/:id/triage — resolve malfunction_triage. */
export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await params;
      const input = triageResolveSchema.parse(await req.json().catch(() => ({})));
      const result = await resolveMalfunctionTriage(ctx, id, input);
      return Response.json(result, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
