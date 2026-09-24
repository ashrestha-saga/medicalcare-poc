import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { releaseRegistrationDraftSchema } from "@/schemas/registration";
import { releaseService } from "@/services/registration/releaseService";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/registration/drafts/[id]/release */
export async function POST(req: Request, ctx: Ctx) {
  let correlationId: string | undefined;
  try {
    const session = await requireTenantContext(req);
    correlationId = session.correlationId;
    const { id } = await ctx.params;
    const input = releaseRegistrationDraftSchema.parse(await req.json().catch(() => ({})));
    const result = await releaseService.release(session, id, input);
    return Response.json({ result }, { headers: { "x-correlation-id": session.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
