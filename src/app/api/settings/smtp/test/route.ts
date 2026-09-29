import { requirePermission, requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { testSmtpSettingsSchema } from "@/schemas/smtpSettings";
import { smtpSettingsService } from "@/services/settings/smtpSettingsService";

/** POST /api/settings/smtp/test — send a test email (settings:smtp). */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      requirePermission(ctx, "settings:smtp");
      const body = testSmtpSettingsSchema.parse(await req.json().catch(() => ({})));
      const result = await smtpSettingsService.testForClinic(ctx, body.to ?? undefined);
      return Response.json({ result }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
