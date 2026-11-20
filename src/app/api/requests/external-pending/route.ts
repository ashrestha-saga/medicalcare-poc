import {
  requireActingContext,
  requirePermission,
  withTenantStore,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { requireRadiationDguvEnabled } from "@/lib/features/radiationDguv";
import { prisma } from "@/lib/prisma";

/** GET /api/requests/external-pending — open Fremdleistung SRs awaiting SV certificate. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      requirePermission(ctx, "requests:approve");
      const tenant = await prisma.tenant.findUnique({
        where: { id: ctx.tenantId },
        select: { featureFlags: true },
      });
      requireRadiationDguvEnabled(tenant?.featureFlags);

      const rows = await prisma.serviceRequest.findMany({
        where: {
          tenantId: ctx.tenantId,
          fulfilment: "external",
          state: { not: "completed" },
          externalCertificateRef: null,
        },
        select: {
          id: true,
          reference: true,
          serviceType: true,
          subjectType: true,
          subjectId: true,
          state: true,
          externalOrgName: true,
          externalCommissionedAt: true,
          duty: { select: { dutyKey: true, dueAt: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      const deviceIds = rows
        .filter((r) => r.subjectType === "instance")
        .map((r) => r.subjectId);
      const devices =
        deviceIds.length > 0
          ? await prisma.deviceInstance.findMany({
              where: { id: { in: deviceIds } },
              select: {
                id: true,
                inventoryNumber: true,
                model: { select: { tradeName: true } },
              },
            })
          : [];
      const byId = new Map(devices.map((d) => [d.id, d]));

      return Response.json(
        {
          requests: rows.map((r) => {
            const device = r.subjectType === "instance" ? byId.get(r.subjectId) : null;
            return {
              id: r.id,
              reference: r.reference,
              serviceType: r.serviceType,
              state: r.state,
              externalOrgName: r.externalOrgName,
              externalCommissionedAt: r.externalCommissionedAt
                ? r.externalCommissionedAt.toISOString().slice(0, 10)
                : null,
              inventoryNumber: device?.inventoryNumber ?? null,
              tradeName: device?.model?.tradeName ?? null,
              dutyKey: r.duty?.dutyKey ?? null,
              dueAt: r.duty?.dueAt?.toISOString().slice(0, 10) ?? null,
            };
          }),
        },
        { headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
