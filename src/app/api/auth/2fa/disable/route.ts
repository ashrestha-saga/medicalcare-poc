import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { totpDisableSchema } from "@/schemas/auth";
import { totpService } from "@/services/auth/totpService";

/** POST /api/auth/2fa/disable — turn off TOTP (password + code). */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const body = totpDisableSchema.parse(await req.json());
    await totpService.disable(ctx, body);
    return Response.json({ ok: true }, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
