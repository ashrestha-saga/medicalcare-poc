import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { updateSiteSchema } from "@/schemas/site";
import { locationService } from "@/services/location/locationService";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/sites/[id] — update location (locations:update). */
export async function PATCH(req: Request, { params }: Params) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const { id } = await params;
    const input = updateSiteSchema.parse(await req.json());
    const site = await locationService.update(ctx, id, input);
    return Response.json({ site }, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** DELETE /api/sites/[id] — delete location (locations:delete). */
export async function DELETE(req: Request, { params }: Params) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const { id } = await params;
    await locationService.remove(ctx, id);
    return Response.json({ ok: true }, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
