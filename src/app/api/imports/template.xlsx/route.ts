import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { importJobService } from "@/services/import/importJobService";

/** GET /api/imports/template.xlsx — E82 DeviceCare §14 template. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const bytes = importJobService.templateBytes();
      return new Response(bytes, {
        headers: {
          "content-type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition":
            'attachment; filename="devicecare-vorlage-bestandsverzeichnis.xlsx"',
          "x-sha256": importJobService.templateSha256(),
          "x-correlation-id": ctx.correlationId,
        },
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
