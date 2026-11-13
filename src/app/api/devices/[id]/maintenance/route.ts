import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { requirePermission } from "@/lib/auth/tenantContext";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/devices/:id/maintenance — Buch Nr. 4 history. */
export async function GET(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      requirePermission(ctx, "devicebook:view");
      const { id } = await params;
      const events = await prisma.maintenanceEvent.findMany({
        where: { deviceInstanceId: id },
        include: {
          parts: true,
          serviceRequest: { select: { id: true, reference: true, serviceType: true } },
        },
        orderBy: { performedAt: "desc" },
      });
      const requests = await prisma.serviceRequest.findMany({
        where: { subjectType: "instance", subjectId: id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          reference: true,
          serviceType: true,
          state: true,
          reason: true,
          createdAt: true,
          proposalState: true,
          mandatory: true,
          checkType: true,
          fulfilment: true,
        },
      });
      return Response.json(
        { events, requests },
        { headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
