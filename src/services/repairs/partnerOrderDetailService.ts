import type { PartnerContext } from "@/interfaces/session";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { forbidden, notFound } from "@/lib/errors";
import { requirePartnerPermission } from "@/lib/auth/tenantContext";
import { prisma } from "@/lib/prisma";
import { isLiveContract } from "@/services/access/partnerAccessService";

export type PartnerOrderDetailDTO = {
  id: string;
  reference: string;
  tenantId: string;
  tenantName: string;
  serviceType: string;
  reason: string | null;
  state: string;
  fulfilment: string;
  priority: string | null;
  note: string | null;
  locationText: string;
  scheduledAt: string | null;
  assigneeName: string | null;
  assigneeUserId: string | null;
  raisedBy: string | null;
  createdAt: string;
  transmittedAt: string | null;
  faultDescription: string | null;
  faultSince: string | null;
  faultConsequence: string | null;
  faultReportedBy: string | null;
  proposalState: string;
  mandatory: boolean;
  checkType: string | null;
  followUpNeeds: string | null;
  followUpUrgency: string | null;
  parentReference: string | null;
  childReferences: string[];
  gateOverride: {
    by: string | null;
    at: string | null;
    reason: string | null;
    kind: string | null;
  } | null;
  sendIn: {
    shippedAt: string | null;
    trackingRef: string | null;
    atWorkshopAt: string | null;
    returnedAt: string | null;
    arrivedAt: string | null;
  };
  device: {
    id: string;
    inventoryNumber: string;
    tradeName: string | null;
    modelName: string | null;
    manufacturer: string | null;
    operationalState: string;
    lockSource: string | null;
    replacedById: string | null;
    loanerInventoryNumber: string | null;
    loanerLender: string | null;
  } | null;
  quote: {
    id: string;
    scopeText: string;
    amountText: string;
    decision: string;
    decidedBy: string | null;
    decidedAt: string | null;
    decisionNote: string | null;
  } | null;
  maintenanceEvents: {
    id: string;
    kind: string;
    performedAt: string;
    /** Protocol wall-clock start (from linked InspectionRun). */
    startedAt: string | null;
    /** Protocol wall-clock finish (from linked InspectionRun). */
    completedAt: string | null;
    performedBy: string | null;
    action: string | null;
    cause: string | null;
    result: string | null;
    postRepairCheck: string | null;
    laborMinutes: number | null;
  }[];
  partsProposals: {
    id: string;
    status: string;
    orderRef: string | null;
    triggeredVia: string;
    lines: { description: string; partNo: string | null; qty: number }[];
  }[];
  attachments: { id: string; kind: string; url: string }[];
  statusEvents: {
    state: string;
    source: string;
    actor: string | null;
    note: string | null;
    at: string;
  }[];
};

function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function isoDateTime(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

/** Partner order detail for disposition (reference lookup). */
export async function getPartnerOrderDetail(
  ctx: PartnerContext,
  reference: string,
): Promise<PartnerOrderDetailDTO> {
  requirePartnerPermission(ctx, "console:disposition:view");

  return runWithoutTenantAsync(async () => {
    const sr = await prisma.serviceRequest.findFirst({
      where: { reference },
      include: {
        tenant: { select: { id: true, name: true } },
        assigneeUser: { select: { id: true, name: true } },
        parentRequest: { select: { reference: true } },
        followUps: { select: { reference: true }, orderBy: { createdAt: "asc" } },
        quote: true,
        attachments: { select: { id: true, kind: true, url: true } },
        statusEvents: {
          orderBy: { changedAt: "asc" },
          select: {
            state: true,
            source: true,
            actor: true,
            note: true,
            changedAt: true,
          },
        },
        maintenanceEvents: {
          orderBy: { performedAt: "desc" },
          select: {
            id: true,
            kind: true,
            performedAt: true,
            inspectionRunId: true,
            performedBy: true,
            action: true,
            cause: true,
            result: true,
            postRepairCheck: true,
            laborMinutes: true,
          },
        },
        partsOrderProposals: {
          where: { organisationId: ctx.organisationId },
          include: { lines: true },
          orderBy: { createdAt: "desc" },
        },
        executorOrg: { select: { organisationId: true } },
      },
    });
    if (!sr) throw notFound("Order not found");

    const isExecutor = sr.executorOrg?.organisationId === ctx.organisationId;
    const contract = await prisma.serviceContract.findFirst({
      where: { organisationId: ctx.organisationId, tenantId: sr.tenantId },
    });
    const manages = Boolean(contract && isLiveContract(contract));
    if (!isExecutor && !manages) throw forbidden();

    let device: PartnerOrderDetailDTO["device"] = null;
    if (sr.subjectType === "instance") {
      const inst = await prisma.deviceInstance.findFirst({
        where: { id: sr.subjectId },
        select: {
          id: true,
          inventoryNumber: true,
          operationalState: true,
          lockSource: true,
          replacedById: true,
          loanerLender: true,
          model: { select: { tradeName: true, modelName: true, manufacturer: true } },
          replacedBy: { select: { inventoryNumber: true, loanerLender: true } },
        },
      });
      if (inst) {
        device = {
          id: inst.id,
          inventoryNumber: inst.inventoryNumber,
          tradeName: inst.model?.tradeName ?? null,
          modelName: inst.model?.modelName ?? null,
          manufacturer: inst.model?.manufacturer ?? null,
          operationalState: inst.operationalState,
          lockSource: inst.lockSource,
          replacedById: inst.replacedById,
          loanerInventoryNumber: inst.replacedBy?.inventoryNumber ?? null,
          loanerLender: inst.replacedBy?.loanerLender ?? inst.loanerLender ?? null,
        };
      }
    }

    return {
      id: sr.id,
      reference: sr.reference,
      tenantId: sr.tenantId,
      tenantName: sr.tenant.name,
      serviceType: sr.serviceType,
      reason: sr.reason,
      state: sr.state,
      fulfilment: sr.fulfilment,
      priority: sr.priority,
      note: sr.note,
      locationText: sr.locationText,
      scheduledAt: isoDateTime(sr.scheduledAt),
      assigneeName: sr.assigneeUser?.name ?? null,
      assigneeUserId: sr.assigneeUserId,
      raisedBy: sr.raisedBy,
      createdAt: sr.createdAt.toISOString(),
      transmittedAt: isoDateTime(sr.transmittedAt),
      faultDescription: sr.faultDescription,
      faultSince: isoDate(sr.faultSince),
      faultConsequence: sr.faultConsequence,
      faultReportedBy: sr.faultReportedBy,
      proposalState: sr.proposalState,
      mandatory: sr.mandatory,
      checkType: sr.checkType,
      followUpNeeds: sr.followUpNeeds,
      followUpUrgency: sr.followUpUrgency,
      parentReference: sr.parentRequest?.reference ?? null,
      childReferences: sr.followUps.map((f) => f.reference),
      gateOverride: sr.gateOverriddenAt
        ? {
            by: sr.gateOverriddenBy,
            at: isoDateTime(sr.gateOverriddenAt),
            reason: sr.gateOverrideReason,
            kind: sr.gateKind ?? null,
          }
        : null,
      sendIn: {
        shippedAt: isoDate(sr.shippedAt),
        trackingRef: sr.trackingRef,
        atWorkshopAt: isoDate(sr.atWorkshopAt),
        returnedAt: isoDate(sr.returnedAt),
        arrivedAt: isoDate(sr.arrivedAt),
      },
      device,
      quote: sr.quote
        ? {
            id: sr.quote.id,
            scopeText: sr.quote.scopeText,
            amountText: sr.quote.amountText,
            decision: sr.quote.decision,
            decidedBy: sr.quote.decidedBy,
            decidedAt: isoDateTime(sr.quote.decidedAt),
            decisionNote: sr.quote.decisionNote,
          }
        : null,
      maintenanceEvents: await (async () => {
        const runIds = sr.maintenanceEvents
          .map((e) => e.inspectionRunId)
          .filter((id): id is string => Boolean(id));
        const runs =
          runIds.length > 0
            ? await prisma.inspectionRun.findMany({
                where: { id: { in: runIds } },
                select: { id: true, startedAt: true, completedAt: true },
              })
            : [];
        const byRun = new Map(runs.map((r) => [r.id, r]));
        return sr.maintenanceEvents.map((e) => {
          const run = e.inspectionRunId ? byRun.get(e.inspectionRunId) : undefined;
          return {
            id: e.id,
            kind: e.kind,
            performedAt: e.performedAt.toISOString(),
            startedAt: isoDateTime(run?.startedAt ?? null),
            completedAt: isoDateTime(run?.completedAt ?? null),
            performedBy: e.performedBy,
            action: e.action,
            cause: e.cause,
            result: e.result,
            postRepairCheck: e.postRepairCheck,
            laborMinutes: e.laborMinutes,
          };
        });
      })(),
      partsProposals: sr.partsOrderProposals.map((p) => ({
        id: p.id,
        status: p.status,
        orderRef: p.orderRef,
        triggeredVia: p.triggeredVia,
        lines: p.lines.map((l) => ({
          description: l.description,
          partNo: l.partNo,
          qty: l.qty,
        })),
      })),
      attachments: sr.attachments,
      statusEvents: sr.statusEvents.map((e) => ({
        state: e.state,
        source: e.source,
        actor: e.actor,
        note: e.note,
        at: e.changedAt.toISOString(),
      })),
    };
  });
}
