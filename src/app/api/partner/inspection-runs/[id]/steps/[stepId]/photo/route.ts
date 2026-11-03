import { requireActingContext } from "@/lib/auth/tenantContext";
import { errorResponse, unprocessable } from "@/lib/errors";
import { inspectionRunService } from "@/services/pruefpartner/inspectionRunService";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string; stepId: string }> };

const schema = z.object({
  dataUrl: z.string().trim().min(32).max(8_000_000),
});

/** POST /api/partner/inspection-runs/[id]/steps/[stepId]/photo — D11 Mangelbild. */
export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    correlationId = ctx.correlationId;
    const { id, stepId } = await params;
    const body = schema.parse(await req.json().catch(() => ({})));
    if (!body.dataUrl.startsWith("data:image/")) {
      throw unprocessable("Photo must be an image data URL.", { field: "dataUrl" });
    }
    const result = await inspectionRunService.attachStepPhoto(ctx, id, stepId, body.dataUrl);
    return Response.json(result, {
      status: 201,
      headers: { "x-correlation-id": ctx.correlationId },
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
