import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { releaseScanChargeSchema } from "@/schemas/k10";
import { scanChargeService } from "@/services/scan/scanChargeService";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/scan/chargen/[id]/release — sign release (Sachkunde + beleg gates). */
export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const { id } = await params;
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = releaseScanChargeSchema.parse(await req.json().catch(() => ({})));
      const result = await scanChargeService.release(ctx, id, input);
      return Response.json({ result }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
