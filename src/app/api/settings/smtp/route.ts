import { requirePermission, requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { upsertSmtpSettingsSchema } from "@/schemas/smtpSettings";
import { smtpSettingsService } from "@/services/settings/smtpSettingsService";

/** GET /api/settings/smtp — clinic SMTP public status (settings:view). */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const smtp = await smtpSettingsService.getForClinic(ctx);
      return Response.json({ smtp }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** PUT /api/settings/smtp — upsert clinic SMTP (settings:smtp). */
export async function PUT(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      requirePermission(ctx, "settings:smtp");
      const input = upsertSmtpSettingsSchema.parse(await req.json());
      const smtp = await smtpSettingsService.upsertForClinic(ctx, input);
      return Response.json(
        { smtp: { ...smtp, canManage: true } },
        { headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
