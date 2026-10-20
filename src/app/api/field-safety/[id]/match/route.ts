import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { matchFieldSafetyDeviceSchema } from "@/schemas/k10";
import { fieldSafetyService } from "@/services/fieldSafety/fieldSafetyService";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const { id } = await params;
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = matchFieldSafetyDeviceSchema.parse(await req.json().catch(() => ({})));
      const action = await fieldSafetyService.matchDevice(ctx, id, input);
      return Response.json({ action }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
