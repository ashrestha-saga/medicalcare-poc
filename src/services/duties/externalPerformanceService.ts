/**
 * E108 — external performance of a duty (third-party firm): evidence upload + due roll.
 * Generalises the SV certificate intake (svExternalService) and external repair report
 * (externalReportService): same blob validation, same completion path (recordDutyCompletion),
 * same SR external* fields — without touching either of them.
 */
import type { TenantWorkContext } from "@/interfaces";
import { notificationDedup } from "@/constants/notifications";
import { actorFromContext } from "@/lib/auth/actorContext";
import { requirePermission } from "@/lib/auth/tenantContext";
import { notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { ExternalPerformanceInput } from "@/schemas/externalPerformance";
import { recordAudit } from "@/services/audit/auditService";
import { notifyService } from "@/services/notifications/notifyService";
import { recordDutyCompletion } from "@/services/registration/recordDutyCompletion";
import { createAttachmentFromDataUrl } from "@/services/storage/attachmentBlobService";

export type ExternalPerformanceResultDTO = {
  dutyId: string;
  performanceId: string;
  attachmentBlobId: string | null;
  nextDue: string | null;
  serviceRequestReference: string | null;
};

/** § 117 StrlSchV — constancy / SV evidence is kept 10 years. */
const TEN_YEAR_DUTY_KEYS = new Set(["konstanz", "sv"]);

function requireAnyPermission(ctx: TenantWorkContext, ...slugs: Parameters<typeof requirePermission>[1][]) {
  for (const slug of slugs) {
    try {
      requirePermission(ctx, slug);
      return;
    } catch {
      /* try next */
    }
  }
  requirePermission(ctx, slugs[0]!);
}

function addYears(d: Date, years: number): Date {
  const out = new Date(d);
  out.setUTCFullYear(out.getUTCFullYear() + years);
  return out;
}

/** Same rule as external repair reports: PDF or image data URLs only. */
function assertEvidenceDataUrl(dataUrl: string) {
  if (!dataUrl.startsWith("data:")) {
    throw unprocessable("dataUrl must be a data URL", { field: "dataUrl" });
  }
  const mime = /^data:([^;,]+)/i.exec(dataUrl)?.[1]?.toLowerCase() ?? "";
  if (mime && mime !== "application/pdf" && !mime.startsWith("image/")) {
    throw unprocessable("Report must be a PDF or image", { field: "dataUrl" });
  }
}

export const externalPerformanceService = {
  async record(
    ctx: TenantWorkContext,
    dutyId: string,
    input: ExternalPerformanceInput,
  ): Promise<ExternalPerformanceResultDTO> {
    requireAnyPermission(ctx, "inventory:update", "requests:create");

    const duty = await prisma.deviceDuty.findFirst({
      where: { id: dutyId, tenantId: ctx.tenantId },
      include: {
        deviceInstance: {
          select: { id: true, inventoryNumber: true, responsibleUserId: true },
        },
      },
    });
    if (!duty) throw notFound("Duty not found.");
    if (duty.suspendedAt) throw unprocessable("This duty was superseded by a later classification.");
    if (!duty.applicable) throw unprocessable("This duty is not applicable.");

    const performedAt = new Date(`${input.performedAt}T00:00:00.000Z`);
    if (Number.isNaN(performedAt.getTime())) {
      throw unprocessable("Invalid performedAt", { field: "performedAt" });
    }
    if (performedAt.getTime() > Date.now() + 86_400_000) {
      throw unprocessable("performedAt must not be in the future", { field: "performedAt" });
    }
    const firm = input.performedBy.trim();
    const note = input.note?.trim() || null;
    if (input.result === "failed" && !note) {
      throw unprocessable("A note is required when the external result is failed.", {
        field: "note",
      });
    }

    // Optional evidence file.
    let attachmentBlobId: string | null = null;
    if (input.attachmentBlobId?.trim()) {
      const blob = await prisma.attachmentBlob.findFirst({
        where: { id: input.attachmentBlobId.trim() },
        select: { id: true },
      });
      if (!blob) throw unprocessable("Unknown attachment", { field: "attachmentBlobId" });
      attachmentBlobId = blob.id;
    } else if (input.dataUrl?.trim()) {
      const dataUrl = input.dataUrl.trim();
      assertEvidenceDataUrl(dataUrl);
      const blob = await createAttachmentFromDataUrl(prisma, {
        tenantId: ctx.tenantId,
        kind: "external_performance",
        dataUrl,
      });
      attachmentBlobId = blob.id;
    }

    // Linked service request — explicit reference, else a single open external request on this duty.
    const openStates = { notIn: ["completed", "rejected"] as ("completed" | "rejected")[] };
    let sr = input.serviceRequestReference?.trim()
      ? await prisma.serviceRequest.findFirst({
          where: {
            reference: input.serviceRequestReference.trim(),
            tenantId: ctx.tenantId,
            dutyId: duty.id,
          },
        })
      : null;
    if (input.serviceRequestReference?.trim() && !sr) {
      throw unprocessable("Service request does not belong to this duty", {
        field: "serviceRequestReference",
      });
    }
    if (sr && (sr.state === "completed" || sr.state === "rejected")) {
      throw unprocessable("Service request is already closed", { field: "serviceRequestReference" });
    }
    if (!sr) {
      const candidates = await prisma.serviceRequest.findMany({
        where: {
          tenantId: ctx.tenantId,
          dutyId: duty.id,
          fulfilment: "external",
          state: openStates,
        },
        take: 2,
      });
      if (candidates.length === 1) sr = candidates[0]!;
    }

    const actor = actorFromContext(ctx);
    const retentionUntil = TEN_YEAR_DUTY_KEYS.has(duty.dutyKey) ? addYears(performedAt, 10) : null;

    const completion = await prisma.$transaction(async (tx) => {
      const done = await recordDutyCompletion(tx, {
        tenantId: ctx.tenantId,
        duty: {
          id: duty.id,
          deviceInstanceId: duty.deviceInstanceId,
          dutyKey: duty.dutyKey,
          title: duty.title,
          deadlineAnchor: duty.deadlineAnchor,
          referenceDate: duty.referenceDate,
          intervalValue: duty.intervalValue,
          intervalUnit: duty.intervalUnit,
          dueAt: duty.dueAt,
          inspectionTypeCode: duty.inspectionTypeCode,
        },
        performedAt,
        performedBy: firm,
        // External actor string — no user account performed it.
        actorUserId: null,
        note,
        source: "external",
        serviceRequestId: sr?.id ?? null,
        result: input.result,
        unitEventSuffix: `extern (erfasst von ${ctx.user.name})`,
        retentionUntil,
        attachmentBlobId,
      });

      if (sr) {
        await tx.serviceRequest.update({
          where: { id: sr.id },
          data: {
            fulfilment: "external",
            externalOrgName: firm,
            externalCertificateDate: performedAt,
            externalCertificateBlobId: attachmentBlobId ?? sr.externalCertificateBlobId,
            externalResult: input.result === "failed" ? "objected" : "passed",
            externalDefectsText: input.result === "failed" ? note : null,
            state: "completed",
          },
        });
        await tx.statusEvent.create({
          data: {
            tenantId: ctx.tenantId,
            serviceRequestId: sr.id,
            state: "completed",
            source: "external_performance",
            actor: actor.actorName || ctx.user.id,
            note: `Externe Durchführung · ${firm} · ${input.result}`,
          },
        });
      }
      return done;
    });

    await recordAudit({
      actor,
      resource: "duty",
      resourceId: duty.id,
      action: "external_performance",
      summary: `External performance (${firm}) for ${duty.title ?? duty.dutyKey}`,
      after: {
        performanceId: completion.dutyPerformanceId,
        performedAt: input.performedAt,
        result: input.result,
        serviceRequestId: sr?.id ?? null,
      },
    });

    // Inbox: tell the responsible person (else clinic admins) that external evidence arrived.
    const inv = duty.deviceInstance.inventoryNumber;
    const dutyLabel = duty.title ?? duty.dutyKey;
    const resultLabel = input.result === "failed" ? "nicht bestanden" : "bestanden";
    const title = `Externe Durchführung: ${inv}`;
    const body = `${dutyLabel} · ${firm} · ${resultLabel}`;
    const target = {
      type: "device" as const,
      id: duty.deviceInstanceId,
      inventoryNumber: inv,
      tenantId: ctx.tenantId,
      focus: "reports" as const,
    };
    const dedup = notificationDedup.externalPerformance(completion.dutyPerformanceId);
    const responsibleId = duty.deviceInstance.responsibleUserId;
    if (responsibleId && responsibleId !== ctx.user.id) {
      await notifyService.pushSafe(
        responsibleId,
        "report_received",
        dedup,
        title,
        body,
        target,
        ctx.tenantId,
        null,
      );
    } else if (!responsibleId) {
      await notifyService.pushToRoles(
        ctx.tenantId,
        ["device_admin", "security_officer"],
        "report_received",
        dedup,
        title,
        body,
        target,
        ctx.tenantId,
        null,
      );
    }

    return {
      dutyId: duty.id,
      performanceId: completion.dutyPerformanceId,
      attachmentBlobId,
      nextDue: completion.nextDue ? completion.nextDue.toISOString().slice(0, 10) : null,
      serviceRequestReference: sr?.reference ?? null,
    };
  },
};
