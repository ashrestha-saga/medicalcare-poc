import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { reportIncidentSchema } from "@/schemas/k10";
import { incidentService } from "@/services/incidents/incidentService";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const { id } = await params;
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = reportIncidentSchema.parse(await req.json().catch(() => ({})));
      const incident = await incidentService.report(ctx, id, input);
      return Response.json({ incident }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
