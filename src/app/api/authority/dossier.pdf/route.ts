import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { dossierPdfSchema } from "@/schemas/k10";
import { authorityDossierExportService } from "@/services/authority/authorityDossierExportService";

/**
 * POST /api/authority/dossier.pdf
 * Authority Begehungsmappe PDF (v26.1 Path B / increment 2).
 */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = dossierPdfSchema.parse(await req.json().catch(() => ({})));
      const { body, filename, rowCount, sha256 } =
        await authorityDossierExportService.exportPdf(ctx, input);
      return new Response(new Uint8Array(body), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "X-Export-Row-Count": String(rowCount),
          "X-Export-Sha256": sha256,
          "x-correlation-id": ctx.correlationId,
        },
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
