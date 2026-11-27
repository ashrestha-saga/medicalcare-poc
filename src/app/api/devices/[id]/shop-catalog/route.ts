import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse, unprocessable } from "@/lib/errors";
import type { ShopCatalogSection } from "@/interfaces/shop";
import { shopCatalogService } from "@/services/shop/shopCatalogService";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/devices/[id]/shop-catalog
 * - default: device shell (primary + variants + counts; empty tab lists)
 * - ?section=accessories|suggestions: lazy tab payload
 */
export async function GET(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await params;
      const url = new URL(req.url);
      const sectionRaw = url.searchParams.get("section")?.trim();
      if (sectionRaw) {
        if (sectionRaw !== "accessories" && sectionRaw !== "suggestions") {
          throw unprocessable("section must be accessories or suggestions.", { field: "section" });
        }
        const section = sectionRaw as ShopCatalogSection;
        const result = await shopCatalogService.getDeviceShopSection(id, section, ctx);
        return Response.json(result, { headers: { "x-correlation-id": ctx.correlationId } });
      }
      const result = await shopCatalogService.getDeviceShopCatalog(id, ctx);
      return Response.json(result, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
