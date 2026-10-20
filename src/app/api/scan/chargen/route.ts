import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { createScanChargeSchema } from "@/schemas/k10";
import { scanChargeService } from "@/services/scan/scanChargeService";

/** GET /api/scan/chargen — open batches in caller's areas (?equipmentDeviceId=). */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const url = new URL(req.url);
      const equipmentDeviceId = url.searchParams.get("equipmentDeviceId") || undefined;
      const list = await scanChargeService.listOpen(ctx, equipmentDeviceId);
      return Response.json(list, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** POST /api/scan/chargen — capture a finished run (unreleased). */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = createScanChargeSchema.parse(await req.json().catch(() => ({})));
      const batch = await scanChargeService.create(ctx, input);
      return Response.json({ batch }, { status: 201, headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
