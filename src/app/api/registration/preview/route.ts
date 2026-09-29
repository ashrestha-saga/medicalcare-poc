import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { registrationPreviewSchema } from "@/schemas/registration";
import { releaseService } from "@/services/registration/releaseService";
import type { RegistrationCharacteristics } from "@/services/registration/types";

/** POST /api/registration/preview — derive duties from characteristics without saving a draft. */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const session = await requireTenantContext(req);
    return await withTenantStore(session, async () => {
      correlationId = session.correlationId;
      const input = registrationPreviewSchema.parse(await req.json());
      const preview = await releaseService.previewFromPayload(session, {
        characteristics: input.characteristics as RegistrationCharacteristics,
        areaId: input.areaId,
        purchaseYear: input.purchaseYear });
      return Response.json(preview, { headers: { "x-correlation-id": session.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
