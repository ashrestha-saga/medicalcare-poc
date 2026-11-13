import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse, unprocessable } from "@/lib/errors";
import { inventoryExportService } from "@/services/inventory/inventoryExportService";

/**
 * GET /api/inventory/export?format=csv&siteId=&areaId=&id=&ids=
 * §14 Bestandsverzeichnis CSV (inventory:export). Partner sessions → 403 via requireTenantContext.
 * Optional `id` (repeated) or comma-separated `ids` limits export to those devices.
 */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const params = new URL(req.url).searchParams;
      const format = (params.get("format") ?? "csv").toLowerCase();
      if (format === "pdf") {
        throw unprocessable("PDF export is not available yet. Use format=csv.");
      }
      if (format !== "csv") {
        throw unprocessable("Unsupported format. Use format=csv.");
      }
      const siteId = params.get("siteId")?.trim() || null;
      const areaId = params.get("areaId")?.trim() || null;
      const fromRepeated = params.getAll("id").map((v) => v.trim()).filter(Boolean);
      const fromCsv = (params.get("ids") ?? "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      const ids = [...fromRepeated, ...fromCsv];
      const { body, filename, rowCount } = await inventoryExportService.exportCsv(ctx, {
        siteId,
        areaId,
        ids: ids.length > 0 ? ids : null,
      });
      return new Response(new Uint8Array(body), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "X-Export-Row-Count": String(rowCount),
          "x-correlation-id": ctx.correlationId,
        },
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
