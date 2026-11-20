import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { dguvShortCompleteSchema } from "@/schemas/radiationDguv";
import { dguvOwnCheckService } from "@/services/duties/dguvOwnCheckService";

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/duties/[id]/complete-dguv-short — R33 own DGUV check. */
export async function POST(req: Request, ctx: RouteContext) {
  let correlationId: string | undefined;
  try {
    const auth = await requireActingContext(req);
    return await withTenantStore(auth, async () => {
      correlationId = auth.correlationId;
      const { id } = await ctx.params;
      const input = dguvShortCompleteSchema.parse(await req.json());
      const result = await dguvOwnCheckService.complete(auth, id, input);
      return Response.json({ result }, { headers: { "x-correlation-id": auth.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
