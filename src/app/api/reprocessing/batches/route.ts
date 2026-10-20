import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { createReprocessingBatchSchema } from "@/schemas/k10";
import { reprocessingEvidenceService } from "@/services/reprocessingEvidence/reprocessingEvidenceService";

export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const batches = await reprocessingEvidenceService.listBatches(ctx);
      return Response.json({ batches }, { headers: { "x-correlation-id": ctx.correlationId } });
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
      const input = createReprocessingBatchSchema.parse(await req.json().catch(() => ({})));
      const batch = await reprocessingEvidenceService.createBatch(ctx, input);
      return Response.json({ batch }, { status: 201, headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
