import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { reclassifyService } from "@/services/registration/reclassifyService";
import { reclassifyCharacteristicsSchema } from "@/schemas/registration";
import type { RegistrationCharacteristics } from "@/services/registration/types";

type Ctx = { params: Promise<{ modelId: string }> };

/** POST /api/registration/reclassify/[modelId]/derive — preview duties for model reclassify. */
export async function POST(req: Request, ctx: Ctx) {
  let correlationId: string | undefined;
  try {
    const session = await requireTenantContext(req);
    return await withTenantStore(session, async () => {
      correlationId = session.correlationId;
      const { modelId } = await ctx.params;
      const parsed = reclassifyCharacteristicsSchema.parse(await req.json());
      const preview = await reclassifyService.derive(
        session,
        modelId,
        parsed.characteristics as RegistrationCharacteristics,
      );
      return Response.json(preview, { headers: { "x-correlation-id": session.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
