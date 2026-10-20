import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { releaseBatchSchema } from "@/schemas/k10";
import { reprocessingEvidenceService } from "@/services/reprocessingEvidence/reprocessingEvidenceService";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const { id } = await params;
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = releaseBatchSchema.parse(await req.json().catch(() => ({})));
      const batch = await reprocessingEvidenceService.release(ctx, id, input);
      return Response.json({ batch }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
