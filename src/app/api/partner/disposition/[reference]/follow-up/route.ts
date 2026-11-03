import {
  requirePartnerContext,
  requirePartnerPermission,
  withTenantBypass,
} from "@/lib/auth/tenantContext";
import { actorFromPartnerOnTenant } from "@/lib/auth/actorContext";
import { errorResponse, forbidden, notFound, unprocessable } from "@/lib/errors";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import { newReference } from "@/lib/crypto";
import { z } from "zod";

type Ctx = { params: Promise<{ reference: string }> };

const schema = z.object({
  followUpNeeds: z.string().trim().min(1).max(2000),
  followUpUrgency: z.enum(["low", "normal", "high"]).optional(),
  reason: z.enum(["befund", "stoerung", "instandsetzung"]).default("befund"),
});

/** POST /api/partner/disposition/[reference]/follow-up — D3 proposal fields. */
export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:disposition:assign", "inspection:propose");
      correlationId = ctx.correlationId;
      const { reference } = await params;
      const input = schema.parse(await req.json().catch(() => ({})));
      const result = await runWithoutTenantAsync(async () => {
        const parent = await prisma.serviceRequest.findFirst({
          where: { reference },
          include: { executorOrg: true },
        });
        if (!parent) throw notFound("Assignment not found.");
        if (parent.executorOrg?.organisationId !== ctx.organisationId) throw forbidden();
        if (!parent.transmittedAt) {
          throw unprocessable("Parent order is not transmitted.", { field: "transmittedAt" });
        }
        const child = await prisma.serviceRequest.create({
          data: {
            reference: newReference("SR"),
            idempotencyKey: `follow-up:${parent.id}:${Date.now()}`,
            fingerprint: `follow-up:${parent.id}:${Date.now()}`,
            tenantId: parent.tenantId,
            subjectType: parent.subjectType,
            subjectId: parent.subjectId,
            serviceType: parent.serviceType,
            note: input.followUpNeeds,
            raisedBy: ctx.user.name,
            raisedById: ctx.user.id,
            siteId: parent.siteId,
            locationText: parent.locationText,
            deliveryAddress: parent.deliveryAddress,
            state: "handed_off",
            source: "app",
            reason: input.reason,
            parentRequestId: parent.id,
            proposedByOrgId: ctx.organisationId,
            followUpNeeds: input.followUpNeeds,
            followUpUrgency: input.followUpUrgency ?? "normal",
            executorOrgId: parent.executorOrgId,
            allocatedAt: new Date(),
            allocatedBy: ctx.user.name,
            transmittedAt: new Date(),
          },
        });
        await recordAudit({
          actor: actorFromPartnerOnTenant(ctx, parent.tenantId, null),
          resource: "service_request",
          resourceId: child.id,
          action: "create",
          summary: `Follow-up proposal ${child.reference} from ${parent.reference}`,
        });
        return { reference: child.reference, id: child.id };
      });
      return Response.json(result, {
        status: 201,
        headers: { "x-correlation-id": ctx.correlationId },
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
