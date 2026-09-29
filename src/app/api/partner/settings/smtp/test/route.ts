import {
  requirePartnerContext,
  requirePartnerPermission,
  withTenantBypass,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { testSmtpSettingsSchema } from "@/schemas/smtpSettings";
import { smtpSettingsService } from "@/services/settings/smtpSettingsService";

/** POST /api/partner/settings/smtp/test — send a test email (console:settings:smtp). */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      correlationId = ctx.correlationId;
      requirePartnerPermission(ctx, "console:settings:smtp");
      const body = testSmtpSettingsSchema.parse(await req.json().catch(() => ({})));
      const result = await smtpSettingsService.testForOrganisation(ctx, body.to ?? undefined);
      return Response.json({ result }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
