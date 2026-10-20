import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { createFieldSafetyWithDevicesSchema } from "@/schemas/k10";
import {
  fieldSafetyService,
  type FieldSafetyListView,
} from "@/services/fieldSafety/fieldSafetyService";

function parseView(raw: string | null): FieldSafetyListView {
  if (raw === "open" || raw === "unmatched") return raw;
  return "all";
}

export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const params = new URL(req.url).searchParams;
      const view = parseView(params.get("view"));
      const actionId = params.get("actionId") ?? undefined;
      const actions = await fieldSafetyService.list(ctx, view, { actionId });
      return Response.json({ actions }, { headers: { "x-correlation-id": ctx.correlationId } });
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
      const input = createFieldSafetyWithDevicesSchema.parse(await req.json().catch(() => ({})));
      const action = await fieldSafetyService.create(ctx, input);
      return Response.json({ action }, { status: 201, headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
