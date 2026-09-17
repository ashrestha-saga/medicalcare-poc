import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { captureRequestSchema } from "@/schemas/resolve";
import { captureService } from "@/services/capture/captureService";

/** Stage 4 — POST /api/captures. `serviceOnly` is never read from the body (DAT-302a). */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const input = captureRequestSchema.parse(await req.json());
    const captured = await captureService.create(input, ctx.tenantId, ctx.user.name);
    return Response.json(captured, { status: 201, headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
