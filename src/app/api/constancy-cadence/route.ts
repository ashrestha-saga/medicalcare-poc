import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { createConstancyCadenceSchema } from "@/schemas/k10";
import { constancyCadenceService } from "@/services/constancy/constancyCadenceService";

export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const [open, missing] = await Promise.all([
        constancyCadenceService.listOpen(ctx),
        constancyCadenceService.listMissing(ctx),
      ]);
      return Response.json({ open, missing }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = createConstancyCadenceSchema.parse(await req.json().catch(() => ({})));
      const cadence = await constancyCadenceService.determine(ctx, input);
      return Response.json({ cadence }, { status: 201, headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
