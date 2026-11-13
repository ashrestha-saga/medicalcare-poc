import type { Prisma } from "@prisma/client";
import type { TenantContext } from "@/interfaces";
import { fingerprint, newReference } from "@/lib/crypto";
import {
  POST_REPAIR_CHECK_SERVICE_TYPE,
  REPAIR_SERVICE_TYPE,
  postRepairCheckByClass,
  type PostRepairCheckKind,
} from "@/constants/repairs";
import { prisma } from "@/lib/prisma";
import { transitionOperationalState } from "@/services/repairs/operationalStateService";

export type RepairOutcomeInput = {
  serviceRequestId: string;
  deviceInstanceId: string;
  result: "repaired" | "provisional" | "not_repairable" | "parts_ordered";
  safetyRelevant: boolean;
  annex1: boolean;
  classHints: {
    radiation?: boolean | null;
    annex2?: boolean | null;
    deviceFamilyCode?: string | null;
    productKindCode?: string | null;
    hasReprocessingProfile?: boolean;
  };
  partsNeedsText?: string | null;
  followUpUrgency?: string | null;
  proposedByOrgId?: string | null;
  actorName: string;
  tenantId: string;
  tx: Prisma.TransactionClient;
  /** Context for operational transitions (permissions skipped via system:true). */
  ctx: {
    tenantId: string;
    user: { id: string; name: string; role?: string };
    correlationId: string;
  };
};

/**
 * R12 + R19 — after a successful K-REP / repair MaintenanceEvent write.
 * Creates follow-up and updates operational state per E72/E78.
 */
export async function applyRepairOutcome(input: RepairOutcomeInput): Promise<{
  postRepairCheck: "mandatory" | "proposed" | "not_needed" | null;
  followUpId: string | null;
  checkType: PostRepairCheckKind | null;
}> {
  const { tx, ctx } = input;
  const checkType = postRepairCheckByClass(input.classHints);

  if (input.result === "parts_ordered" || input.result === "provisional") {
    await transitionOperationalState(ctx, {
      deviceInstanceId: input.deviceInstanceId,
      to: "under_repair",
      lockSource: "inspection",
      note: input.result,
      system: true,
      tx,
    });
    const child = await tx.serviceRequest.create({
      data: {
        reference: newReference("SR"),
        idempotencyKey: `repair-cont-${input.serviceRequestId}-${input.result}`,
        fingerprint: fingerprint({
          parent: input.serviceRequestId,
          kind: "continuation",
          result: input.result,
        }),
        tenantId: input.tenantId,
        subjectType: "instance",
        subjectId: input.deviceInstanceId,
        serviceType: REPAIR_SERVICE_TYPE,
        raisedBy: input.actorName,
        locationText: "—",
        deliveryAddress: "—",
        state: "captured",
        source: "repair_outcome",
        reason: "instandsetzung",
        parentRequestId: input.serviceRequestId,
        proposedByOrgId: input.proposedByOrgId ?? null,
        followUpNeeds: input.partsNeedsText ?? input.result,
        followUpUrgency: input.followUpUrgency ?? null,
        proposalState: "proposed",
        statusEvents: {
          create: {
            tenantId: input.tenantId,
            state: "captured",
            source: "repair_outcome",
            actor: input.actorName,
            note: `Continuation after ${input.result}`,
          },
        },
      },
    });
    return { postRepairCheck: null, followUpId: child.id, checkType: null };
  }

  if (input.result === "not_repairable") {
    await transitionOperationalState(ctx, {
      deviceInstanceId: input.deviceInstanceId,
      to: "locked",
      lockSource: "inspection",
      note: "not_repairable",
      system: true,
      tx,
    });
    return { postRepairCheck: null, followUpId: null, checkType: null };
  }

  // repaired
  if (input.safetyRelevant) {
    await transitionOperationalState(ctx, {
      deviceInstanceId: input.deviceInstanceId,
      to: "locked",
      lockSource: "inspection",
      note: "Awaiting mandatory post-repair check",
      system: true,
      tx,
    });
    const child = await tx.serviceRequest.create({
      data: {
        reference: newReference("SR"),
        idempotencyKey: `prc-mandatory-${input.serviceRequestId}`,
        fingerprint: fingerprint({ parent: input.serviceRequestId, kind: "prc", mandatory: true }),
        tenantId: input.tenantId,
        subjectType: "instance",
        subjectId: input.deviceInstanceId,
        serviceType: POST_REPAIR_CHECK_SERVICE_TYPE,
        raisedBy: input.actorName,
        locationText: "—",
        deliveryAddress: "—",
        state: "captured",
        source: "repair_outcome",
        reason: "instandsetzung",
        parentRequestId: input.serviceRequestId,
        proposedByOrgId: input.proposedByOrgId ?? null,
        mandatory: true,
        proposalState: "none",
        checkType,
        statusEvents: {
          create: {
            tenantId: input.tenantId,
            state: "captured",
            source: "repair_outcome",
            actor: input.actorName,
            note: "Mandatory post-repair check",
          },
        },
      },
    });
    return { postRepairCheck: "mandatory", followUpId: child.id, checkType };
  }

  if (input.annex1) {
    await transitionOperationalState(ctx, {
      deviceInstanceId: input.deviceInstanceId,
      to: "in_service",
      note: "Proposed post-repair check",
      system: true,
      tx,
    });
    const child = await tx.serviceRequest.create({
      data: {
        reference: newReference("SR"),
        idempotencyKey: `prc-proposed-${input.serviceRequestId}`,
        fingerprint: fingerprint({ parent: input.serviceRequestId, kind: "prc", mandatory: false }),
        tenantId: input.tenantId,
        subjectType: "instance",
        subjectId: input.deviceInstanceId,
        serviceType: POST_REPAIR_CHECK_SERVICE_TYPE,
        raisedBy: input.actorName,
        locationText: "—",
        deliveryAddress: "—",
        state: "captured",
        source: "repair_outcome",
        reason: "instandsetzung",
        parentRequestId: input.serviceRequestId,
        proposedByOrgId: input.proposedByOrgId ?? null,
        mandatory: false,
        proposalState: "proposed",
        checkType,
        statusEvents: {
          create: {
            tenantId: input.tenantId,
            state: "captured",
            source: "repair_outcome",
            actor: input.actorName,
            note: "Proposed post-repair check",
          },
        },
      },
    });
    return { postRepairCheck: "proposed", followUpId: child.id, checkType };
  }

  await transitionOperationalState(ctx, {
    deviceInstanceId: input.deviceInstanceId,
    to: "in_service",
    note: "Repair complete — no follow-up check",
    system: true,
    tx,
  });
  return { postRepairCheck: "not_needed", followUpId: null, checkType: null };
}

/** Load class hints for a device instance (open classification + reprocessing profile). */
export async function loadClassHints(deviceInstanceId: string) {
  const device = await prisma.deviceInstance.findFirst({
    where: { id: deviceInstanceId },
    select: {
      productKindCode: true,
      modelId: true,
      reprocessingProfile: { select: { deviceInstanceId: true } },
      model: {
        select: {
          classifications: {
            where: { validTo: null },
            orderBy: { validFrom: "desc" },
            take: 1,
            select: {
              stk: true,
              mtkItemId: true,
              radiation: true,
              deviceFamilyCode: true,
            },
          },
        },
      },
    },
  });
  const cls = device?.model?.classifications[0];
  return {
    /** Anlage-1 proxy: open classification with STK flag. */
    annex1: Boolean(cls?.stk),
    hints: {
      radiation: cls?.radiation ?? null,
      annex2: Boolean(cls?.mtkItemId),
      deviceFamilyCode: cls?.deviceFamilyCode ?? null,
      productKindCode: device?.productKindCode ?? null,
      hasReprocessingProfile: Boolean(device?.reprocessingProfile),
    },
  };
}
