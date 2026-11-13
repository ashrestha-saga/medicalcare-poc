import type { PartnerContext } from "@/interfaces/session";
import type {
  InspectFollowUpListDTO,
  InspectFollowUpStatus,
} from "@/interfaces/pruefpartner";
import type { ProposeFollowUpInput } from "@/schemas/pruefpartner";
import { actorFromPartnerOnTenant } from "@/lib/auth/actorContext";
import { newReference } from "@/lib/crypto";
import { forbidden, notFound, unprocessable } from "@/lib/errors";
import { prismaSystem } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import { getCachedPartnerConsolePermissions } from "@/services/roles/roleGrantsService";
import { requirePartnerPermission } from "@/lib/auth/tenantContext";

/** Prisma where for the inspect Nachbesuche list — own proposals only. */
export function inspectFollowUpListWhere(userId: string, organisationId: string) {
  return {
    raisedById: userId,
    parentRequestId: { not: null },
    state: { not: "rejected" as const },
    executorOrg: { organisationId },
  };
}

/** Map SR fields to a simple inspect-rail status (not disposition display states). */
export function inspectFollowUpStatus(input: {
  state: string;
  assigneeUserId: string | null;
  scheduledAt: Date | string | null;
}): InspectFollowUpStatus {
  if (input.state === "completed") return "done";
  if (input.state === "in_progress") return "in_progress";
  if (input.state === "scheduled" || input.scheduledAt) return "scheduled";
  if (input.assigneeUserId) return "assigned";
  return "waiting";
}

function deviceLabelFrom(
  subjectType: string,
  subjectId: string,
  locationText: string,
  devices: Map<string, string>,
): string {
  if (subjectType === "instance") {
    return devices.get(subjectId) || locationText || subjectId;
  }
  return locationText || subjectId;
}

/** Nachbesuche — follow-up proposals created by the signed-in technician. */
export const inspectFollowUpService = {
  async listForCurrentUser(ctx: PartnerContext): Promise<InspectFollowUpListDTO> {
    const granted = getCachedPartnerConsolePermissions(ctx.user.appRole);
    const allowed =
      granted.includes("inspections:view") ||
      granted.includes("inspection:propose") ||
      granted.includes("console:nav");
    if (!allowed) throw forbidden();

    const rows = await prismaSystem.serviceRequest.findMany({
      where: inspectFollowUpListWhere(ctx.user.id, ctx.organisationId),
      include: {
        parentRequest: { select: { reference: true } },
        assigneeUser: { select: { name: true } },
        tenant: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const instanceIds = [
      ...new Set(rows.filter((r) => r.subjectType === "instance").map((r) => r.subjectId)),
    ];
    const devices = new Map<string, string>();
    if (instanceIds.length > 0) {
      const found = await prismaSystem.deviceInstance.findMany({
        where: { id: { in: instanceIds } },
        select: {
          id: true,
          inventoryNumber: true,
          model: { select: { tradeName: true, modelName: true } },
        },
      });
      for (const d of found) {
        const trade = d.model?.tradeName?.trim() || null;
        const model = d.model?.modelName?.trim() || null;
        const inv = d.inventoryNumber?.trim() || null;
        devices.set(d.id, trade || model || inv || d.id);
      }
    }

    return {
      rows: rows.map((r) => ({
        reference: r.reference,
        parentReference: r.parentRequest?.reference ?? null,
        tenantId: r.tenantId,
        tenantName: r.tenant?.name ?? null,
        deviceLabel: deviceLabelFrom(r.subjectType, r.subjectId, r.locationText, devices),
        followUpNeeds: r.followUpNeeds,
        followUpUrgency: r.followUpUrgency,
        state: r.state,
        status: inspectFollowUpStatus({
          state: r.state,
          assigneeUserId: r.assigneeUserId,
          scheduledAt: r.scheduledAt,
        }),
        assigneeName: r.assigneeUser?.name ?? null,
        scheduledAt: r.scheduledAt ? r.scheduledAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  },

  /** Create a child follow-up proposal for a transmitted parent assignment. */
  async propose(
    ctx: PartnerContext,
    parentReference: string,
    input: ProposeFollowUpInput,
  ): Promise<{ reference: string; id: string }> {
    requirePartnerPermission(ctx, "console:disposition:assign", "inspection:propose");

    const parent = await prismaSystem.serviceRequest.findFirst({
      where: { reference: parentReference },
      include: { executorOrg: true },
    });
    if (!parent) throw notFound("Assignment not found.");
    if (parent.executorOrg?.organisationId !== ctx.organisationId) throw forbidden();
    if (!parent.transmittedAt) {
      throw unprocessable("Parent order is not transmitted.", { field: "transmittedAt" });
    }

    const child = await prismaSystem.serviceRequest.create({
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
  },
};
