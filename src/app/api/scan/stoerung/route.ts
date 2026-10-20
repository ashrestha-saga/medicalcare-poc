import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { reportMalfunctionSchema } from "@/schemas/k10";
import { deviceBookService } from "@/services/deviceBook/deviceBookService";

/** POST /api/scan/stoerung — Scan Störung melden (book + optional unassessed incident). */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = reportMalfunctionSchema.parse(await req.json().catch(() => ({})));
      const result = await deviceBookService.reportMalfunction(ctx, input);
      return Response.json({ result }, { status: 201, headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
