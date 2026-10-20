import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { uploadDeviceBookIfuSchema } from "@/schemas/k10";
import { deviceBookService } from "@/services/deviceBook/deviceBookService";

/** POST — upload / replace IFU (Gebrauchsanweisung) for a book device. */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = uploadDeviceBookIfuSchema.parse(await req.json().catch(() => ({})));
      const evidence = await deviceBookService.uploadIfu(ctx, input);
      return Response.json(
        { evidence },
        { status: 201, headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
