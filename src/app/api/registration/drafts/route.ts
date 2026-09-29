import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { createRegistrationDraftSchema } from "@/schemas/registration";
import { draftService } from "@/services/registration/draftService";
import type { RegistrationCharacteristics } from "@/services/registration/types";

/** POST /api/registration/drafts */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = createRegistrationDraftSchema.parse(await req.json());
      const draft = await draftService.create(ctx, {
        ...input,
        characteristics: input.characteristics as RegistrationCharacteristics | undefined,
        keepDraft: input.keepDraft,
        clarifications: input.clarifications,
      });
      return Response.json({ draft }, { status: 201, headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
