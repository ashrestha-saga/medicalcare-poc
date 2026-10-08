import { requireActingContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { confirmDeviceSchema } from "@/schemas/pruefpartner";
import { inspectionRunService } from "@/services/pruefpartner/inspectionRunService";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/partner/inspection-runs/[id]/confirm-device */
export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    const { id } = await params;
    correlationId = ctx.correlationId;
    const body = confirmDeviceSchema.parse(await req.json());
    await inspectionRunService.confirmDevice(ctx, id, body);
    return Response.json({ ok: true }, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
