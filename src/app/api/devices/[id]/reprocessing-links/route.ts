import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { reprocessingLinkService } from "@/services/registration/reprocessingLinkService";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/devices/[id]/reprocessing-links — equipment linked to this product. */
export async function GET(req: Request, ctx: Ctx) {
  let correlationId: string | undefined;
  try {
    const acting = await requireActingContext(req);
    return await withTenantStore(acting, async () => {
      correlationId = acting.correlationId;
      const { id } = await ctx.params;
      const url = new URL(req.url);
      const as = url.searchParams.get("as") ?? "product";
      const items =
        as === "equipment"
          ? await reprocessingLinkService.listForEquipment(acting, id)
          : await reprocessingLinkService.listForProduct(acting, id);
      const validation =
        as === "product"
          ? await reprocessingLinkService.productValidationStatus(acting, id)
          : null;
      return Response.json(
        { items, validation },
        { headers: { "x-correlation-id": acting.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** POST /api/devices/[id]/reprocessing-links — link equipment to this product. */
export async function POST(req: Request, ctx: Ctx) {
  let correlationId: string | undefined;
  try {
    const acting = await requireActingContext(req);
    return await withTenantStore(acting, async () => {
      correlationId = acting.correlationId;
      const { id } = await ctx.params;
      const body = (await req.json()) as { equipmentDeviceId?: string };
      const link = await reprocessingLinkService.link(acting, {
        profileDeviceId: id,
        equipmentDeviceId: body.equipmentDeviceId ?? "",
      });
      return Response.json(link, {
        status: 201,
        headers: { "x-correlation-id": acting.correlationId },
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
