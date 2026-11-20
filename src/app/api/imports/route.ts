import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse, unprocessable } from "@/lib/errors";
import { importJobService } from "@/services/import/importJobService";
import { isInventoryImportEnabled } from "@/services/import/featureFlag";

/** GET /api/imports — list jobs. POST — upload multipart file. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      await isInventoryImportEnabled(ctx.tenantId);
      const jobs = await importJobService.list(ctx);
      return Response.json({ jobs }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      await isInventoryImportEnabled(ctx.tenantId);
      // Clinic: inventory:update · Partner: import:manage (asserted in service)
      await importJobService.assertMayImport(ctx);
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw unprocessable("Expected multipart field `file`.");
      const name = file.name.toLowerCase();
      if (!/\.(xlsx|xls|csv)$/.test(name)) {
        throw unprocessable("Upload an Excel (.xlsx / .xls) or CSV file.");
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const template = String(form.get("template") || "excel_14");
      const result = await importJobService.upload(ctx, {
        fileName: file.name,
        buffer,
        template,
      });
      return Response.json(result, {
        status: 201,
        headers: { "x-correlation-id": ctx.correlationId },
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
