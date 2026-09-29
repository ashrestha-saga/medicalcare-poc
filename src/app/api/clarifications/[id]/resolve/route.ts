import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { clarificationService } from "@/services/clarifications/clarificationService";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/clarifications/[id]/resolve */
export async function POST(req: Request, ctx: Ctx) {
  let correlationId: string | undefined;
  try {
    const acting = await requireActingContext(req);
    return await withTenantStore(acting, async () => {
      correlationId = acting.correlationId;
      const { id } = await ctx.params;
      const body = (await req.json().catch(() => ({}))) as { note?: string | null };
      const result = await clarificationService.resolve(acting, id, body);
      return Response.json(result, { headers: { "x-correlation-id": acting.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
