import type { RepairResult } from "@prisma/client";
import type { ActingContext } from "@/interfaces";
import { conflict, notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { K_REP_CATALOGUE_CODE, REPAIR_SERVICE_TYPE } from "@/constants/repairs";
import {
  applyRepairOutcome,
  loadClassHints,
} from "@/services/repairs/repairOutcomeService";
import { recordAudit } from "@/services/audit/auditService";

export type CompleteRepairInput = {
  inspectionRunId: string;
  result: RepairResult;
  action: string;
  cause?: string | null;
  faultConfirmed?: boolean | null;
  laborMinutes?: number | null;
  softwareBefore?: string | null;
  softwareAfter?: string | null;
  functionTestPassed?: boolean | null;
  safetyRelevant: boolean;
  resultText?: string | null;
  parts: { description: string; partNo?: string | null; serialNo?: string | null; qty?: number }[];
  followUpUrgency?: string | null;
};

/**
 * R11 — fold a sealed/completed K-REP run into one MaintenanceEvent(kind=repair).
 * Idempotent on inspectionRunId.
 */
export async function completeRepairFromRun(ctx: ActingContext, input: CompleteRepairInput) {
  const existing = await prisma.maintenanceEvent.findUnique({
    where: { inspectionRunId: input.inspectionRunId },
    include: { parts: true },
  });
  if (existing) return { event: existing, created: false as const };

  const run = await prisma.inspectionRun.findFirst({
    where: { id: input.inspectionRunId, tenantId: ctx.tenantId },
    include: {
      catalogue: true,
      serviceRequest: true,
      signatures: true,
      stepResults: { include: { attachments: true, step: true } },
    },
  });
  if (!run) throw notFound("Inspection run not found");
  if (run.catalogue?.code !== K_REP_CATALOGUE_CODE && run.serviceRequest?.serviceType !== REPAIR_SERVICE_TYPE) {
    // Allow if catalogue is K-REP or linked request is repair
    if (run.catalogue?.code !== K_REP_CATALOGUE_CODE) {
      throw conflict("Not a K-REP repair run");
    }
  }

  if (!input.result) throw unprocessable("result required");
  if (input.action === "part_replaced") {
    if (!input.parts.length) {
      throw unprocessable("part_replaced requires at least one part", { field: "parts" });
    }
    const failEvidence = run.stepResults.some(
      (r) => r.attachments.length > 0 || Boolean(r.noPhotoReason?.trim()),
    );
    // Photo may live on step attachments; if none, require noPhotoReason somewhere
    if (!failEvidence) {
      // soft: allow if any step has noPhotoReason intentionally for parts photo
      const hasPhotoOrReason = run.stepResults.some(
        (r) => r.attachments.length > 0 || Boolean(r.noPhotoReason?.trim()),
      );
      if (!hasPhotoOrReason) {
        throw unprocessable("part_replaced requires a photo or noPhotoReason");
      }
    }
  }
  if (
    input.result !== "not_repairable" &&
    input.result !== "parts_ordered" &&
    input.functionTestPassed == null
  ) {
    throw unprocessable("functionTestPassed required unless parts_ordered/not_repairable");
  }

  const openQuote = run.serviceRequestId
    ? await prisma.quote.findFirst({
        where: { serviceRequestId: run.serviceRequestId, decision: "rejected" },
      })
    : null;
  if (openQuote && input.result === "repaired") {
    throw conflict("Cannot complete as repaired while quote is rejected", {
      code: "QUOTE_REJECTED",
    });
  }

  const deviceInstanceId = run.deviceInstanceId;
  if (!deviceInstanceId) throw unprocessable("Run has no device instance");

  const { annex1, hints } = await loadClassHints(deviceInstanceId);
  const partsNeeds = input.parts.map((p) => `${p.description} ×${p.qty ?? 1}`).join("; ");

  const outcome = await prisma.$transaction(async (tx) => {
    const event = await tx.maintenanceEvent.create({
      data: {
        tenantId: ctx.tenantId,
        deviceInstanceId,
        kind: "repair",
        performedAt: new Date(),
        actorUserId: ctx.user.id,
        serviceRequestId: run.serviceRequestId,
        inspectionRunId: run.id,
        performedBy: `${ctx.user.name}${ctx.user.organisationName ? ` · ${ctx.user.organisationName}` : ""}`,
        performedByOrgId: ctx.user.accountKind === "partner" ? ctx.user.organisationId : null,
        faultConfirmed: input.faultConfirmed ?? null,
        cause: input.cause?.trim() || null,
        action: input.action,
        laborMinutes: input.laborMinutes ?? null,
        softwareBefore: input.softwareBefore ?? null,
        softwareAfter: input.softwareAfter ?? null,
        functionTestPassed: input.functionTestPassed ?? null,
        safetyRelevant: input.safetyRelevant,
        result: input.result,
        resultText:
          input.resultText?.trim() ||
          `${input.action} · ${input.result}${partsNeeds ? ` · ${partsNeeds}` : ""}`,
        source: "partner",
        parts: {
          create: input.parts.map((p) => ({
            tenantId: ctx.tenantId,
            description: p.description.trim(),
            partNo: p.partNo?.trim() || null,
            serialNo: p.serialNo?.trim() || null,
            qty: p.qty ?? 1,
          })),
        },
      },
      include: { parts: true },
    });

    let followUpId: string | null = null;
    let postRepairCheck: "mandatory" | "proposed" | "not_needed" | null = null;

    if (run.serviceRequestId) {
      const applied = await applyRepairOutcome({
        serviceRequestId: run.serviceRequestId,
        deviceInstanceId,
        result: input.result,
        safetyRelevant: input.safetyRelevant,
        annex1,
        classHints: hints,
        partsNeedsText: partsNeeds || null,
        followUpUrgency: input.followUpUrgency ?? null,
        proposedByOrgId: ctx.user.accountKind === "partner" ? ctx.user.organisationId : null,
        actorName: ctx.user.name,
        tenantId: ctx.tenantId,
        tx,
        ctx: {
          tenantId: ctx.tenantId,
          user: { id: ctx.user.id, name: ctx.user.name },
          correlationId: ctx.correlationId,
        },
      });
      followUpId = applied.followUpId;
      postRepairCheck = applied.postRepairCheck;
      await tx.maintenanceEvent.update({
        where: { id: event.id },
        data: { postRepairCheck: applied.postRepairCheck },
      });
      await tx.serviceRequest.update({
        where: { id: run.serviceRequestId },
        data: { state: "completed" },
      });
    }

    return { event, followUpId, postRepairCheck };
  });

  await recordAudit({
    actor: ctx.actor,
    resource: "MaintenanceEvent",
    resourceId: outcome.event.id,
    action: "repair_complete",
    summary: `K-REP complete → ${input.result}`,
    after: { followUpId: outcome.followUpId, postRepairCheck: outcome.postRepairCheck },
  });

  return { ...outcome, created: true as const };
}
