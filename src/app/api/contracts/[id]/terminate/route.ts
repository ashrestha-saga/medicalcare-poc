import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { contractLifecycleService } from "@/services/access/contractLifecycleService";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/contracts/[id]/terminate */
export async function POST(req: Request, ctx: Ctx) {
  let correlationId: string | undefined;
  try {
    const session = await requireTenantContext(req);
    return await withTenantStore(session, async () => {
      correlationId = session.correlationId;
      const { id } = await ctx.params;
      const result = await contractLifecycleService.terminateByClinic(session, id);
      return Response.json(result, { headers: { "x-correlation-id": session.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
