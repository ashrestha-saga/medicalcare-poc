import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { submitScanKonstanzSchema } from "@/schemas/k10";
import { scanKonstanzService } from "@/services/scan/scanKonstanzService";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/scan/devices/[id]/konstanz — open constancy duties for Scan. */
export async function GET(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const { id } = await params;
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const open = await scanKonstanzService.listOpen(ctx, id);
      return Response.json({ konstanz: open }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** POST /api/scan/devices/[id]/konstanz — record constancy result (DutyPerformance). */
export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const { id } = await params;
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = submitScanKonstanzSchema.parse(await req.json().catch(() => ({})));
      const result = await scanKonstanzService.submit(ctx, id, input);
      return Response.json({ result }, { status: 201, headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
