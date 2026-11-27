/**
 * E106 / RD45 — sealed inspection report (PDF) rendering, storage and download.
 * The PDF is a pure function of the sealed run, stored as an AttachmentBlob and linked
 * via InspectionRun.reportBlobId / reportSha256 (+ DutyPerformance.attachmentBlobId when empty).
 */
import { createHash } from "node:crypto";
import type { TenantWorkContext } from "@/interfaces";
import type { ReportJobResultDTO, ReportRenderResultDTO } from "@/interfaces/reports";
import { notificationDedup } from "@/constants/notifications";
import { requirePermission } from "@/lib/auth/tenantContext";
import { runWithTenantAsync, runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { forbidden, notFound, unprocessable } from "@/lib/errors";
import { errorMessage, logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { notifyService } from "@/services/notifications/notifyService";
import {
  createAttachmentFromDataUrl,
  pdfDataUrl,
  readAttachmentBytes,
} from "@/services/storage/attachmentBlobService";
import {
  renderInspectionReportPdf,
  type InspectionReportPdfInput,
} from "./inspectionReportPdf";

const REPORT_BLOB_KIND = "inspection_report";
const JOB_BATCH = 50;

function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function isoDateTime(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

async function loadSealedRun(runId: string) {
  return prisma.inspectionRun.findFirst({
    where: { id: runId },
    include: {
      catalogue: { include: { steps: { orderBy: { position: "asc" } } } },
      stepResults: true,
      signatures: { orderBy: { kind: "asc" } },
      organisation: { select: { name: true } },
      testEquipment: { select: { label: true, serialNumber: true, traceabilityRef: true } },
      occasion: { select: { label: true } },
      dutyPerformance: {
        select: { id: true, attachmentBlobId: true, labelNumber: true, labelNextDue: true },
      },
      serviceRequest: { select: { reference: true } },
      deviceInstance: {
        select: {
          inventoryNumber: true,
          serialNumber: true,
          room: true,
          model: { select: { tradeName: true, modelName: true, manufacturer: true } },
          area: { select: { name: true, site: { select: { name: true } } } },
        },
      },
    },
  });
}

type SealedRun = NonNullable<Awaited<ReturnType<typeof loadSealedRun>>>;

function toPdfInput(run: SealedRun, tenantName: string): InspectionReportPdfInput {
  const resultByStep = new Map(run.stepResults.map((r) => [r.stepId, r]));
  const dev = run.deviceInstance;
  const location = [dev.area?.site?.name, dev.area?.name, dev.room].filter(Boolean).join(" · ");
  return {
    runId: run.id,
    tenantName,
    assignmentReference: run.serviceRequest?.reference ?? null,
    catalogue: {
      code: run.catalogue.code,
      label: run.catalogue.label,
      legalBasis: run.catalogue.legalBasis,
    },
    device: {
      inventoryNumber: dev.inventoryNumber,
      serialNumber: dev.serialNumber,
      label: dev.model?.tradeName || dev.model?.modelName || dev.inventoryNumber,
      manufacturer: dev.model?.manufacturer ?? null,
      location: location || null,
    },
    performedAt: isoDate(run.performedAt)!,
    startedAt: isoDateTime(run.startedAt),
    completedAt: isoDateTime(run.completedAt ?? run.performedAt)!,
    performedBy: run.performedByName,
    organisationName: run.organisation?.name ?? null,
    testEquipment: run.testEquipment,
    occasion: run.occasion?.label ?? run.occasionCode,
    result: run.result,
    note: run.note,
    labelNumber: run.dutyPerformance?.labelNumber ?? null,
    labelNextDue: isoDate(run.dutyPerformance?.labelNextDue),
    steps: run.catalogue.steps.map((s) => {
      const r = resultByStep.get(s.id);
      return {
        position: s.position,
        label: s.label,
        unit: s.unit,
        limitText: s.limitText,
        confirmed: r?.confirmed ?? null,
        measuredValue: r?.measuredValue ?? null,
        withinLimit: r?.withinLimit ?? null,
        note: r?.note ?? null,
      };
    }),
    signatures: run.signatures.map((s) => ({
      kind: s.kind,
      signerName: s.signerName,
      signerRole: s.signerRole,
      signedAt: isoDateTime(s.signedAt),
      absent: s.absent,
      absentReason: s.absentReason,
    })),
  };
}

/** Notify the clinic that a sealed report arrived (best effort). */
async function notifyReportReceived(run: SealedRun) {
  const recipients = await notifyService.clinicRecipients(run.tenantId, [
    "device_admin",
    "security_officer",
  ]);
  await notifyService.pushToMany(
    recipients,
    "report_received",
    notificationDedup.reportReceived(run.id),
    `Prüfbericht eingegangen: ${run.deviceInstance.inventoryNumber}`,
    `${run.catalogue.label} — bitte bestätigen.`,
    {
      type: "device",
      id: run.deviceInstanceId,
      inventoryNumber: run.deviceInstance.inventoryNumber,
      tenantId: run.tenantId,
      focus: "reports",
    },
    run.tenantId,
    run.organisationId,
  );
}

export const inspectionReportService = {
  /**
   * Render + store the report for a sealed run. Idempotent: an existing reportBlobId is returned as-is.
   * Must run inside a tenant store (or bypass) so the AttachmentBlob insert is stamped.
   */
  async renderReportForRun(runId: string): Promise<ReportRenderResultDTO> {
    const run = await loadSealedRun(runId);
    if (!run) throw notFound("Inspection run not found.");
    if (!run.dutyPerformanceId && !run.completedAt) {
      throw unprocessable("Only sealed inspection runs have a report.");
    }
    if (run.reportBlobId && run.reportSha256) {
      return {
        runId: run.id,
        reportBlobId: run.reportBlobId,
        reportSha256: run.reportSha256,
        rendered: false,
      };
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: run.tenantId },
      select: { name: true },
    });
    const bytes = await renderInspectionReportPdf(toPdfInput(run, tenant?.name ?? ""));
    const sha256 = createHash("sha256").update(bytes).digest("hex");

    const blob = await createAttachmentFromDataUrl(prisma, {
      tenantId: run.tenantId,
      kind: REPORT_BLOB_KIND,
      dataUrl: pdfDataUrl(bytes),
    });
    await prisma.attachmentBlob.update({ where: { id: blob.id }, data: { sha256 } });

    await prisma.$transaction(async (tx) => {
      await tx.inspectionRun.update({
        where: { id: run.id },
        data: { reportBlobId: blob.id, reportSha256: sha256 },
      });
      if (run.dutyPerformanceId && !run.dutyPerformance?.attachmentBlobId) {
        await tx.dutyPerformance.update({
          where: { id: run.dutyPerformanceId },
          data: { attachmentBlobId: blob.id },
        });
      }
    });

    await notifyReportReceived(run).catch((error) =>
      logger.warn("inspection_report.notify_failed", { runId: run.id, error: errorMessage(error) }),
    );
    return { runId: run.id, reportBlobId: blob.id, reportSha256: sha256, rendered: true };
  },

  /**
   * Called after the seal transaction. Sync attempt; on failure the run keeps
   * reportBlobId = null and POST /api/jobs/reports fills it later. Never throws.
   */
  async enqueueOrRenderAfterSeal(runId: string): Promise<void> {
    try {
      await inspectionReportService.renderReportForRun(runId);
    } catch (error) {
      logger.warn("inspection_report.render_deferred", {
        runId,
        error: errorMessage(error),
      });
    }
  },

  /** Retry job — sealed runs (dutyPerformanceId set) without a report. */
  async runReportJob(limit = JOB_BATCH): Promise<ReportJobResultDTO> {
    const pending = await runWithoutTenantAsync(() =>
      prisma.inspectionRun.findMany({
        where: { dutyPerformanceId: { not: null }, reportBlobId: null },
        select: { id: true, tenantId: true },
        orderBy: { completedAt: "asc" },
        take: limit,
      }),
    );
    let rendered = 0;
    let failed = 0;
    for (const row of pending) {
      try {
        await runWithTenantAsync(row.tenantId, () =>
          inspectionReportService.renderReportForRun(row.id),
        );
        rendered += 1;
      } catch (error) {
        failed += 1;
        logger.warn("inspection_report.job_failed", { runId: row.id, error: errorMessage(error) });
      }
    }
    return { scanned: pending.length, rendered, failed };
  },

  /**
   * Bytes for download. Clinic: inventory:view. Partner: only runs of the caller's own organisation.
   * Renders lazily when the run is sealed but has no stored report yet.
   */
  async getReportForDownload(
    ctx: TenantWorkContext,
    runId: string,
  ): Promise<{ bytes: Buffer; filename: string; sha256: string }> {
    const run = await prisma.inspectionRun.findFirst({
      where: { id: runId, tenantId: ctx.tenantId },
      select: {
        id: true,
        organisationId: true,
        reportBlobId: true,
        dutyPerformanceId: true,
        performedAt: true,
        deviceInstance: { select: { inventoryNumber: true } },
      },
    });
    if (!run) throw notFound("Inspection run not found.");

    if (ctx.user.accountKind === "partner") {
      if (!run.organisationId || run.organisationId !== ctx.user.organisationId) {
        throw forbidden();
      }
    } else {
      requirePermission(ctx, "inventory:view");
    }
    if (!run.dutyPerformanceId) throw unprocessable("This inspection run is not sealed yet.");

    let blobId = run.reportBlobId;
    if (!blobId) {
      blobId = (await inspectionReportService.renderReportForRun(run.id)).reportBlobId;
    }
    const stored = await readAttachmentBytes(prisma, blobId);
    if (!stored) throw notFound("Report file is missing.");
    const sha256 = createHash("sha256").update(stored.bytes).digest("hex");
    const safeInv = run.deviceInstance.inventoryNumber.replace(/[^\w.-]+/g, "_");
    return {
      bytes: stored.bytes,
      sha256,
      filename: `Pruefbericht_${safeInv}_${isoDate(run.performedAt)}.pdf`,
    };
  },
};
