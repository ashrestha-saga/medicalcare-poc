import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { quoteDecideSchema } from "@/schemas/repairs";
import { decideQuote } from "@/services/repairs/quoteService";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/requests/:id/quote/decide — R10 clinic decide (id = serviceRequest id or reference). */
export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await params;
      const input = quoteDecideSchema.parse(await req.json().catch(() => ({})));
      const sr = await prisma.serviceRequest.findFirst({
        where: { OR: [{ id }, { reference: id }], tenantId: ctx.tenantId },
        select: { id: true },
      });
      const result = await decideQuote(ctx, sr?.id ?? id, input);
      return Response.json({ quote: result }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
