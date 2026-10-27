import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { discloseResourceSchema } from "@/schemas/k10";
import { authorityService } from "@/services/authority/authorityService";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/authority/sessions/:id/disclosed — protocol “Gezeigt” list. */
export async function GET(req: Request, ctxParams: Ctx) {
  let correlationId: string | undefined;
  try {
    const { id } = await ctxParams.params;
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const disclosed = await authorityService.listDisclosed(ctx, id);
      return Response.json({ disclosed }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** POST /api/authority/sessions/:id/disclosed — protocol “Gezeigt” (R4). */
export async function POST(req: Request, ctxParams: Ctx) {
  let correlationId: string | undefined;
  try {
    const { id } = await ctxParams.params;
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const body = discloseResourceSchema.parse(await req.json());
      const result = await authorityService.recordDisclosed(ctx, id, body);
      return Response.json(result, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
