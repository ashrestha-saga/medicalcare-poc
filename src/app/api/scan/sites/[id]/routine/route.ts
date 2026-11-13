import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { submitScanRoutineSchema } from "@/schemas/k10";
import { scanRoutineService } from "@/services/scan/scanRoutineService";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/scan/sites/[id]/routine — open daily site (Haus) checks. */
export async function GET(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const { id } = await params;
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const open = await scanRoutineService.listOpenForSite(ctx, id);
      return Response.json({ routine: open }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** POST /api/scan/sites/[id]/routine — record today's site daily checks. */
export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const { id } = await params;
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = submitScanRoutineSchema.parse(await req.json().catch(() => ({})));
      const result = await scanRoutineService.submitForSite(ctx, id, input);
      return Response.json({ result }, { status: 201, headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
