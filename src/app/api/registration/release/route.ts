import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { commitRegistrationSchema } from "@/schemas/registration";
import { releaseService } from "@/services/registration/releaseService";
import type { RegistrationCharacteristics } from "@/services/registration/types";

/** POST /api/registration/release — persist identity + characteristics and release. */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const session = await requireTenantContext(req);
    correlationId = session.correlationId;
    const input = commitRegistrationSchema.parse(await req.json());
    const result = await releaseService.commit(session, {
      ...input,
      characteristics: input.characteristics as RegistrationCharacteristics,
    });
    return Response.json({ result }, { headers: { "x-correlation-id": session.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
