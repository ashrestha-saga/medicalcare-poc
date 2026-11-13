import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { unlockDeviceSchema } from "@/schemas/repairs";
import { operationalStateService } from "@/services/repairs/operationalStateService";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/devices/:id/unlock — R13 clinic unlock. */
export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await params;
      const input = unlockDeviceSchema.parse(await req.json().catch(() => ({})));
      const result = await operationalStateService.unlock(ctx, id, input.note);
      return Response.json(result, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
