import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { deviceDossierService } from "@/services/reports/deviceDossierService";

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/devices/:id/export/dossier — Gerätemappe ZIP (export:dossier), logged as ExportLog(kind=dossier). */
export async function POST(req: Request, ctxParams: RouteContext) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await ctxParams.params;
      const { body, filename, fileCount, sha256 } = await deviceDossierService.exportZip(ctx, id);
      return new Response(new Uint8Array(body), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "X-Export-File-Count": String(fileCount),
          "X-Content-SHA256": sha256,
          "x-correlation-id": ctx.correlationId,
        },
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
