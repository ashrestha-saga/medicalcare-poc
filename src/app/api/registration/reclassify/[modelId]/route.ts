import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { reclassifyService } from "@/services/registration/reclassifyService";
import { reclassifyApplySchema, reclassifyCharacteristicsSchema } from "@/schemas/registration";
import type { RegistrationCharacteristics } from "@/services/registration/types";

type Ctx = { params: Promise<{ modelId: string }> };

/** GET /api/registration/reclassify/[modelId] — bootstrap model-wide reclassify (catalog:update). */
export async function GET(req: Request, ctx: Ctx) {
  let correlationId: string | undefined;
  try {
    const session = await requireTenantContext(req);
    return await withTenantStore(session, async () => {
      correlationId = session.correlationId;
      const { modelId } = await ctx.params;
      const context = await reclassifyService.getContext(session, modelId);
      return Response.json({ context }, { headers: { "x-correlation-id": session.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** POST /api/registration/reclassify/[modelId] — apply model-wide reclassification. */
export async function POST(req: Request, ctx: Ctx) {
  let correlationId: string | undefined;
  try {
    const session = await requireTenantContext(req);
    return await withTenantStore(session, async () => {
      correlationId = session.correlationId;
      const { modelId } = await ctx.params;
      const parsed = reclassifyApplySchema.parse(await req.json());
      const result = await reclassifyService.apply(session, modelId, {
        characteristics: parsed.characteristics as RegistrationCharacteristics,
        checks: parsed.checks,
        acknowledgeImpact: parsed.acknowledgeImpact,
        classificationConfidence: parsed.classificationConfidence,
        evidenceText: parsed.evidenceText });
      return Response.json({ result }, { headers: { "x-correlation-id": session.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
