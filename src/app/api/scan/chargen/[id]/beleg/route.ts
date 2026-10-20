import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { attachScanChargeBelegSchema } from "@/schemas/k10";
import { scanChargeService } from "@/services/scan/scanChargeService";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/scan/chargen/[id]/beleg — attach process-record photo (SHA-256). */
export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const { id } = await params;
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = attachScanChargeBelegSchema.parse(await req.json().catch(() => ({})));
      const batch = await scanChargeService.attachBeleg(ctx, id, input);
      return Response.json({ batch }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
