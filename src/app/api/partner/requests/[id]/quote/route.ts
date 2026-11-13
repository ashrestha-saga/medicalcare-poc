import {
  requireActingContext,
  withTenantStore,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { quoteUpsertSchema } from "@/schemas/repairs";
import { upsertQuote } from "@/services/repairs/quoteService";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

/** PUT /api/partner/requests/:id/quote — R10 partner quote. */
export async function PUT(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await params;
      const input = quoteUpsertSchema.parse(await req.json().catch(() => ({})));
      const sr = await prisma.serviceRequest.findFirst({
        where: { OR: [{ id }, { reference: id }], tenantId: ctx.tenantId },
        select: { id: true },
      });
      const quote = await upsertQuote(ctx, sr?.id ?? id, input);
      return Response.json({ quote }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
