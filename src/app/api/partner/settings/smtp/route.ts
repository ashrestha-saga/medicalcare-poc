import {
  requirePartnerContext,
  requirePartnerPermission,
  withTenantBypass,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { upsertSmtpSettingsSchema } from "@/schemas/smtpSettings";
import { smtpSettingsService } from "@/services/settings/smtpSettingsService";

/** GET /api/partner/settings/smtp — organisation SMTP public status. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      correlationId = ctx.correlationId;
      const smtp = await smtpSettingsService.getForOrganisation(ctx);
      return Response.json({ smtp }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** PUT /api/partner/settings/smtp — upsert organisation SMTP. */
export async function PUT(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      correlationId = ctx.correlationId;
      requirePartnerPermission(ctx, "console:settings:smtp");
      const input = upsertSmtpSettingsSchema.parse(await req.json());
      const smtp = await smtpSettingsService.upsertForOrganisation(ctx, input);
      return Response.json(
        { smtp: { ...smtp, canManage: true } },
        { headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
