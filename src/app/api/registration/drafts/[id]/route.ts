import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { updateRegistrationDraftSchema } from "@/schemas/registration";
import { draftService } from "@/services/registration/draftService";
import type { RegistrationCharacteristics } from "@/services/registration/types";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/registration/drafts/[id] */
export async function GET(req: Request, ctx: Ctx) {
  let correlationId: string | undefined;
  try {
    const session = await requireTenantContext(req);
    correlationId = session.correlationId;
    const { id } = await ctx.params;
    const draft = await draftService.get(session, id);
    return Response.json({ draft }, { headers: { "x-correlation-id": session.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** PATCH /api/registration/drafts/[id] */
export async function PATCH(req: Request, ctx: Ctx) {
  let correlationId: string | undefined;
  try {
    const session = await requireTenantContext(req);
    correlationId = session.correlationId;
    const { id } = await ctx.params;
    const input = updateRegistrationDraftSchema.parse(await req.json());
    const draft = await draftService.update(session, id, {
      ...input,
      characteristics: input.characteristics as RegistrationCharacteristics | undefined,
    });
    return Response.json({ draft }, { headers: { "x-correlation-id": session.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
