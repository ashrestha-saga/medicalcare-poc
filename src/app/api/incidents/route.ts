import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { createIncidentSchema } from "@/schemas/k10";
import { incidentService, type IncidentListView } from "@/services/incidents/incidentService";

function parseView(raw: string | null): IncidentListView {
  if (raw === "unassessed" || raw === "unreported" || raw === "open") return raw;
  return "all";
}

export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const view = parseView(new URL(req.url).searchParams.get("view"));
      const { incidents, kpis } = await incidentService.list(ctx, view);
      return Response.json(
        { incidents, kpis },
        { headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = createIncidentSchema.parse(await req.json().catch(() => ({})));
      const incident = await incidentService.create(ctx, input);
      return Response.json({ incident }, { status: 201, headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
