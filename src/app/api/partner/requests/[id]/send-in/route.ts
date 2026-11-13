import {
  requireActingContext,
  withTenantStore,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { sendInStepSchema } from "@/schemas/repairs";
import { advanceSendIn } from "@/services/repairs/sendInService";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

/** PUT /api/partner/requests/:id/send-in — R18 timeline step. */
export async function PUT(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await params;
      const input = sendInStepSchema.parse(await req.json().catch(() => ({})));
      const sr = await prisma.serviceRequest.findFirst({
        where: { OR: [{ id }, { reference: id }], tenantId: ctx.tenantId },
        select: { id: true },
      });
      const row = await advanceSendIn(ctx, sr?.id ?? id, input);
      return Response.json({ request: row }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
