/**
 * E85 / R39 + R42 — Sammelauftrag (group subject) + DGUV mitnehmen hint.
 */
import type { TenantWorkContext, ActingContext } from "@/interfaces";
import { actorFromContext } from "@/lib/auth/actorContext";
import { requirePermission } from "@/lib/auth/tenantContext";
import { fingerprint, newReference } from "@/lib/crypto";
import { notFound, unprocessable } from "@/lib/errors";
import { requireRadiationDguvEnabled } from "@/lib/features/radiationDguv";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import { personPassesServiceTypeGate } from "@/services/gates/serviceTypeGateService";

async function requireFlag(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { featureFlags: true },
  });
  requireRadiationDguvEnabled(tenant?.featureFlags);
}

export const collectiveOrderService = {
  async createGroup(
    ctx: TenantWorkContext,
    input: {
      siteId: string;
      deviceInstanceIds: string[];
      serviceType: string;
      note?: string | null;
      visitId?: string | null;
      dutyId?: string | null;
      /** Partner executor — required for console list visibility. */
      executorOrgId?: string | null;
      assigneeUserId?: string | null;
    },
  ) {
    requirePermission(ctx, "requests:create");
    await requireFlag(ctx.tenantId);

    if (!input.deviceInstanceIds.length) {
      throw unprocessable("At least one device required", { field: "deviceInstanceIds" });
    }

    const site = await prisma.site.findFirst({ where: { id: input.siteId } });
    if (!site) throw notFound("Site not found");

    const devices = await prisma.deviceInstance.findMany({
      where: { id: { in: input.deviceInstanceIds }, tenantId: ctx.tenantId },
      select: { id: true, inventoryNumber: true, area: { select: { siteId: true } } },
    });
    if (devices.length !== input.deviceInstanceIds.length) {
      throw unprocessable("One or more devices not found");
    }

    let executorOrgId = input.executorOrgId ?? null;
    if (!executorOrgId && ctx.user.accountKind === "partner" && ctx.user.organisationId) {
      const exec = await prisma.executorOrg.findFirst({
        where: { organisationId: ctx.user.organisationId },
        select: { id: true },
      });
      executorOrgId = exec?.id ?? null;
    }

    let assigneeUserId = input.assigneeUserId ?? null;
    if (!assigneeUserId && input.visitId) {
      const visit = await prisma.serviceVisit.findFirst({
        where: { id: input.visitId, tenantId: ctx.tenantId },
        select: { technicianUserId: true },
      });
      assigneeUserId = visit?.technicianUserId ?? null;
    }

    const reference = newReference("SR");
    const idempotencyKey = `group:${ctx.tenantId}:${input.siteId}:${input.serviceType}:${Date.now()}`;
    const actor = actorFromContext(ctx);
    const now = new Date();

    const created = await prisma.$transaction(async (tx) => {
      const sr = await tx.serviceRequest.create({
        data: {
          reference,
          idempotencyKey,
          fingerprint: fingerprint({
            siteId: input.siteId,
            devices: input.deviceInstanceIds,
            serviceType: input.serviceType,
          }),
          tenantId: ctx.tenantId,
          subjectType: "group",
          subjectId: input.siteId,
          siteId: input.siteId,
          serviceType: input.serviceType,
          locationText: site.name,
          deliveryAddress: site.name,
          note: input.note?.trim() || null,
          raisedBy: actor.actorName || ctx.user.id,
          raisedById: ctx.user.id,
          visitId: input.visitId ?? null,
          dutyId: input.dutyId ?? null,
          source: "app",
          state: assigneeUserId ? "acknowledged" : "captured",
          executorOrgId,
          assigneeUserId,
          allocatedAt: executorOrgId ? now : null,
          allocatedBy: executorOrgId ? actor.actorName || ctx.user.id : null,
          transmittedAt: now,
        },
      });

      let position = 1;
      for (const id of input.deviceInstanceIds) {
        await tx.serviceRequestItem.create({
          data: {
            tenantId: ctx.tenantId,
            serviceRequestId: sr.id,
            deviceInstanceId: id,
            position: position++,
            status: "open",
          },
        });
      }
      return sr;
    });

    await recordAudit({
      actor,
      resource: "ServiceRequest",
      resourceId: created.id,
      action: "create_sammelauftrag",
      summary: `Sammelauftrag ${reference} · ${input.deviceInstanceIds.length} devices`,
    });

    return { reference: created.reference, id: created.id, itemCount: input.deviceInstanceIds.length };
  },

  async progress(ctx: TenantWorkContext | ActingContext, serviceRequestId: string) {
    const items = await prisma.serviceRequestItem.findMany({
      where: { serviceRequestId, tenantId: ctx.tenantId },
      orderBy: { position: "asc" },
      include: {
        deviceInstance: { select: { inventoryNumber: true, kind: true } },
      },
    });
    const done = items.filter((i) => i.status === "done" || i.status === "skipped").length;
    return {
      total: items.length,
      done,
      items: items.map((i) => ({
        id: i.id,
        position: i.position,
        status: i.status,
        inventoryNumber: i.deviceInstance.inventoryNumber,
        kind: i.deviceInstance.kind,
        inspectionRunId: i.inspectionRunId,
        skippedReason: i.skippedReason,
      })),
    };
  },

  async markItemDone(
    ctx: ActingContext,
    serviceRequestId: string,
    deviceInstanceId: string,
    inspectionRunId: string,
  ) {
    await requireFlag(ctx.tenantId);
    const item = await prisma.serviceRequestItem.findFirst({
      where: { serviceRequestId, deviceInstanceId, tenantId: ctx.tenantId },
    });
    if (!item) throw notFound("Collective item not found");
    await prisma.serviceRequestItem.update({
      where: { id: item.id },
      data: { status: "done", inspectionRunId },
    });
    const progress = await this.progress(ctx, serviceRequestId);
    if (progress.done >= progress.total && progress.total > 0) {
      await prisma.serviceRequest.update({
        where: { id: serviceRequestId },
        data: { state: "completed" },
      });
    }
    return progress;
  },

  async skipItem(
    ctx: ActingContext,
    serviceRequestId: string,
    deviceInstanceId: string,
    reason: string,
  ) {
    await requireFlag(ctx.tenantId);
    if (!reason.trim()) throw unprocessable("skip reason required", { field: "reason" });
    const item = await prisma.serviceRequestItem.findFirst({
      where: { serviceRequestId, deviceInstanceId, tenantId: ctx.tenantId },
    });
    if (!item) throw notFound("Collective item not found");
    await prisma.serviceRequestItem.update({
      where: { id: item.id },
      data: { status: "skipped", skippedReason: reason.trim() },
    });
    return this.progress(ctx, serviceRequestId);
  },

  /**
   * R42 — DGUV mitnehmen: due dguv duties at the same site as an STK visit,
   * only when the technician passes the dguv gate.
   */
  async dguvMitnehmenHint(
    ctx: ActingContext,
    input: { siteId: string; visitDate?: string; technicianUserId: string },
  ) {
    await requireFlag(ctx.tenantId);
    const orgId =
      ctx.user.accountKind === "partner" ? ctx.user.organisationId : null;
    if (!orgId) return { count: 0, deviceIds: [] as string[], show: false };

    const passes = await personPassesServiceTypeGate({
      organisationId: orgId,
      serviceType: "dguv",
      userId: input.technicianUserId,
    });
    if (!passes) {
      return {
        count: 0,
        deviceIds: [] as string[],
        show: false,
        reason: "technician_fails_dguv_gate" as const,
      };
    }

    const horizon = input.visitDate
      ? new Date(`${input.visitDate}T00:00:00.000Z`)
      : new Date();
    horizon.setUTCDate(horizon.getUTCDate() + 30);

    const duties = await prisma.deviceDuty.findMany({
      where: {
        tenantId: ctx.tenantId,
        dutyKey: "dguv",
        applicable: true,
        suspendedAt: null,
        dueAt: { lte: horizon },
        deviceInstance: { area: { siteId: input.siteId } },
      },
      select: { deviceInstanceId: true },
    });

    const deviceIds = [...new Set(duties.map((d) => d.deviceInstanceId))];
    // Exclude devices that already have an open dguv request
    const open = await prisma.serviceRequest.findMany({
      where: {
        tenantId: ctx.tenantId,
        serviceType: { in: ["DGUV", "dguv"] },
        state: { notIn: ["completed", "rejected"] },
        OR: [
          { subjectType: "instance", subjectId: { in: deviceIds } },
          {
            subjectType: "group",
            items: { some: { deviceInstanceId: { in: deviceIds } } },
          },
        ],
      },
      select: {
        subjectType: true,
        subjectId: true,
        items: { select: { deviceInstanceId: true } },
      },
    });
    const busy = new Set<string>();
    for (const r of open) {
      if (r.subjectType === "instance") busy.add(r.subjectId);
      for (const it of r.items) busy.add(it.deviceInstanceId);
    }
    const free = deviceIds.filter((id) => !busy.has(id));
    return { count: free.length, deviceIds: free, show: free.length > 0 };
  },

  async attachDguvToVisit(
    ctx: TenantWorkContext,
    input: { siteId: string; visitId: string; deviceInstanceIds: string[] },
  ) {
    await requireFlag(ctx.tenantId);
    return this.createGroup(ctx, {
      siteId: input.siteId,
      deviceInstanceIds: input.deviceInstanceIds,
      serviceType: "dguv",
      visitId: input.visitId,
      note: "DGUV mitnehmen (Sammelauftrag)",
    });
  },
};
