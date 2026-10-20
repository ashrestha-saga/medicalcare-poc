import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { assignIncidentSchema } from "@/schemas/k10";
import { incidentService } from "@/services/incidents/incidentService";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let correlationId: string | undefined;
  try {
    const { id } = await ctx.params;
    const tenantCtx = await requireTenantContext(req);
    return await withTenantStore(tenantCtx, async () => {
      correlationId = tenantCtx.correlationId;
      const input = assignIncidentSchema.parse(await req.json().catch(() => ({})));
      const incident = await incidentService.assign(tenantCtx, id, input);
      return Response.json(
        { incident },
        { headers: { "x-correlation-id": tenantCtx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
