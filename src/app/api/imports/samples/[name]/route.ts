import { readFileSync } from "node:fs";
import { join } from "node:path";
import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse, notFound } from "@/lib/errors";
import { isInventoryImportEnabled } from "@/services/import/featureFlag";

const SAMPLES: Record<string, { file: string; contentType: string }> = {
  "praxis-1": {
    file: "praxis-1-hausarzt-bestandsverzeichnis.xlsx",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  "praxis-2": {
    file: "praxis-2-mvz-geraeteliste.xlsx",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  "praxis-3": {
    file: "praxis-3-chirurgie-inventar.csv",
    contentType: "text/csv; charset=utf-8",
  },
};

/** GET /api/imports/samples/:name — demo fixtures for the import wizard. */
export async function GET(_req: Request, ctxParams: { params: Promise<{ name: string }> }) {
  let correlationId: string | undefined;
  try {
    const { name } = await ctxParams.params;
    const ctx = await requireActingContext(_req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      await isInventoryImportEnabled(ctx.tenantId);
      const sample = SAMPLES[name];
      if (!sample) throw notFound("Sample file");
      const bytes = readFileSync(join(process.cwd(), "fixtures/import", sample.file));
      return new Response(new Uint8Array(bytes), {
        headers: {
          "content-type": sample.contentType,
          "content-disposition": `attachment; filename="${sample.file}"`,
          "x-correlation-id": ctx.correlationId,
        },
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
