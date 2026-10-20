import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { remediateFindingSchema } from "@/schemas/k10";
import { authorityService } from "@/services/authority/authorityService";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const { id } = await params;
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = remediateFindingSchema.parse(await req.json().catch(() => ({})));
      const finding = await authorityService.remediate(ctx, id, input);
      return Response.json({ finding }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
