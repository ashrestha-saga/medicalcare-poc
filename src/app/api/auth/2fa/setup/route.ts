import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { totpConfirmSetupSchema } from "@/schemas/auth";
import { totpService } from "@/services/auth/totpService";

/** POST /api/auth/2fa/setup — start enrollment (QR + secret). */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const setup = await totpService.startSetup(ctx);
    return Response.json(setup, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** DELETE /api/auth/2fa/setup — cancel pending enrollment. */
export async function DELETE(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    await totpService.cancelSetup(ctx);
    return Response.json({ ok: true }, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** PUT /api/auth/2fa/setup — confirm enrollment with TOTP code. */
export async function PUT(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const body = totpConfirmSetupSchema.parse(await req.json());
    const result = await totpService.confirmSetup(ctx, body.code);
    return Response.json(result, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
