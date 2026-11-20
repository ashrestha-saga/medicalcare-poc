import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { collectiveOrderService } from "@/services/orders/collectiveOrderService";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/requests/group/:id/progress — Sammelauftrag n/total (RD26). */
export async function GET(req: Request, ctxParams: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await ctxParams.params;
      const sr = await prisma.serviceRequest.findFirst({
        where: {
          tenantId: ctx.tenantId,
          OR: [{ id }, { reference: id }],
          subjectType: "group",
        },
        select: { id: true, reference: true },
      });
      if (!sr) throw notFound("Group request not found");
      const progress = await collectiveOrderService.progress(ctx, sr.id);
      return Response.json(
        { reference: sr.reference, progress },
        { headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
