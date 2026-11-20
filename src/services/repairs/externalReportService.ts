import type { RepairResult } from "@prisma/client";
import type { TenantWorkContext } from "@/interfaces";
import { actorFromContext } from "@/lib/auth/actorContext";
import { recordedByAttribution } from "@/lib/auth/attribution";
import { requirePermission } from "@/lib/auth/tenantContext";
import { fingerprint, newReference } from "@/lib/crypto";
import { forbidden, notFound, unprocessable } from "@/lib/errors";
import { isRepairsEnabled } from "@/lib/features/repairs";
import { prisma } from "@/lib/prisma";
import {
  POST_REPAIR_CHECK_SERVICE_TYPE,
  postRepairCheckByClass,
} from "@/constants/repairs";
import { recordAudit } from "@/services/audit/auditService";
import { loadClassHints } from "@/services/repairs/repairOutcomeService";
import { createAttachmentFromDataUrl } from "@/services/storage/attachmentBlobService";

async function assertRepairs(ctx: TenantWorkContext) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { featureFlags: true },
  });
  if (!isRepairsEnabled(tenant?.featureFlags)) {
    throw forbidden("Repairs feature is not enabled for this tenant");
  }
}

function hasPermissionAny(ctx: TenantWorkContext, ...slugs: Parameters<typeof requirePermission>[1][]) {
  for (const s of slugs) {
    try {
      requirePermission(ctx, s);
      return;
    } catch {
      /* try next */
    }
  }
  requirePermission(ctx, slugs[0]!);
}

/** R17 — clinic records an external (third-party) repair. */
export async function createExternalRepairReport(
  ctx: TenantWorkContext,
  input: {
    deviceInstanceId: string;
    performedAt: string;
    action: string;
    resultText: string;
    externalPerformer: string;
    result?: RepairResult | null;
    reportBlobId?: string | null;
    reportDataUrl?: string | null;
    partsText?: string | null;
    laborMinutes?: number | null;
    createFollowUp?: boolean;
    followUpSkippedReason?: string | null;
  },
) {
  hasPermissionAny(ctx, "inventory:update", "requests:approve");
  await assertRepairs(ctx);

  if (!input.externalPerformer.trim()) {
    throw unprocessable("Company / performer required", { field: "externalPerformer" });
  }
  if (!input.action.trim() || !input.resultText.trim()) {
    throw unprocessable("action and resultText required");
  }

  const createFollowUp = input.createFollowUp !== false;
  if (!createFollowUp && !input.followUpSkippedReason?.trim()) {
    throw unprocessable("Skipping follow-up requires a reason", {
      field: "followUpSkippedReason",
    });
  }

  const device = await prisma.deviceInstance.findFirst({
    where: { id: input.deviceInstanceId },
    select: { id: true, inventoryNumber: true },
  });
  if (!device) throw notFound("Device not found");

  let reportBlobId = input.reportBlobId?.trim() || null;
  if (!reportBlobId && input.reportDataUrl?.trim()) {
    const dataUrl = input.reportDataUrl.trim();
    if (!dataUrl.startsWith("data:")) {
      throw unprocessable("reportDataUrl must be a data URL", { field: "reportDataUrl" });
    }
    const mime = /^data:([^;,]+)/i.exec(dataUrl)?.[1]?.toLowerCase() ?? "";
    if (mime && mime !== "application/pdf" && !mime.startsWith("image/")) {
      throw unprocessable("Report must be a PDF or image", { field: "reportDataUrl" });
    }
    const blob = await createAttachmentFromDataUrl(prisma, {
      tenantId: ctx.tenantId,
      kind: "external_repair_report",
      dataUrl,
    });
    reportBlobId = blob.id;
  }

  const { hints } = await loadClassHints(device.id);
  const checkType = postRepairCheckByClass(hints);
  const performedAt = new Date(`${input.performedAt}T00:00:00.000Z`);
  const attribution = recordedByAttribution(ctx);

  const result = await prisma.$transaction(async (tx) => {
    const event = await tx.maintenanceEvent.create({
      data: {
        tenantId: ctx.tenantId,
        deviceInstanceId: device.id,
        kind: "repair",
        performedAt,
        note: input.partsText?.trim() || null,
        actorUserId: ctx.user.id,
        performedBy: `${input.externalPerformer.trim()}, extern`,
        action: input.action.trim(),
        resultText: input.resultText.trim(),
        result: input.result ?? "repaired",
        laborMinutes: input.laborMinutes ?? null,
        source: "external",
        externalPerformer: input.externalPerformer.trim(),
        reportBlobId,
        followUpSkippedReason: createFollowUp ? null : input.followUpSkippedReason!.trim(),
        postRepairCheck: createFollowUp ? "proposed" : "not_needed",
      },
    });

    await tx.deviceBookEntry.create({
      data: {
        tenantId: ctx.tenantId,
        deviceInstanceId: device.id,
        kind: "note",
        occurredAt: performedAt,
        description: `Instandsetzung (extern): ${input.resultText.trim()}`,
        consequence: `Quelle extern · ${input.externalPerformer.trim()}`,
        ...attribution,
      },
    });

    await tx.deviceUnitEvent.create({
      data: {
        tenantId: ctx.tenantId,
        deviceInstanceId: device.id,
        actor: ctx.user.name,
        action: "external_repair",
        note: input.externalPerformer.trim(),
      },
    });

    let followUpId: string | null = null;
    if (createFollowUp) {
      const child = await tx.serviceRequest.create({
        data: {
          reference: newReference("SR"),
          idempotencyKey: `ext-prc-${event.id}`,
          fingerprint: fingerprint({ eventId: event.id, kind: "external_prc" }),
          tenantId: ctx.tenantId,
          subjectType: "instance",
          subjectId: device.id,
          serviceType: POST_REPAIR_CHECK_SERVICE_TYPE,
          raisedBy: ctx.user.name,
          raisedById: ctx.user.id,
          locationText: "—",
          deliveryAddress: "—",
          state: "captured",
          source: "external_report",
          reason: "instandsetzung",
          proposalState: "proposed",
          checkType,
          statusEvents: {
            create: {
              tenantId: ctx.tenantId,
              state: "captured",
              source: "external_report",
              actor: ctx.user.name,
              note: `Follow-up from external report ${event.id}`,
            },
          },
        },
      });
      followUpId = child.id;
    }

    return { event, followUpId };
  });

  await recordAudit({
    actor: actorFromContext(ctx),
    resource: "MaintenanceEvent",
    resourceId: result.event.id,
    action: "external_repair",
    summary: `External repair on ${device.inventoryNumber}`,
    after: { followUpId: result.followUpId, checkType },
  });

  return result;
}
