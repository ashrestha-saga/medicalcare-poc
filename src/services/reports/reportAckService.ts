/**
 * E106 / RD45 — report listing per device + clinic acknowledgement of sealed reports.
 */
import type { TenantWorkContext } from "@/interfaces";
import type {
  AcknowledgePerformanceResultDTO,
  DeviceReportDTO,
  DeviceReportsDTO,
  PendingReportDTO,
  PendingReportsDTO,
} from "@/interfaces/reports";
import { notificationDedup } from "@/constants/notifications";
import { actorFromContext } from "@/lib/auth/actorContext";
import { requirePermission } from "@/lib/auth/tenantContext";
import { forbidden, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import { notifyService } from "@/services/notifications/notifyService";

const LIST_LIMIT = 50;

export function reportUrlFor(args: { runId: string | null; attachmentBlobId: string | null }) {
  if (args.runId) return `/api/inspection-runs/${args.runId}/report`;
  if (args.attachmentBlobId) return `/api/attachments/${args.attachmentBlobId}`;
  return null;
}

export const reportAckService = {
  async listForDevice(ctx: TenantWorkContext, deviceId: string): Promise<DeviceReportsDTO> {
    requirePermission(ctx, "inventory:view");
    const device = await prisma.deviceInstance.findFirst({
      where: { id: deviceId },
      select: { id: true },
    });
    if (!device) throw notFound("Device not found.");

    const rows = await prisma.dutyPerformance.findMany({
      where: {
        deviceDuty: { deviceInstanceId: deviceId },
        OR: [{ inspectionRun: { isNot: null } }, { attachmentBlobId: { not: null } }],
      },
      orderBy: [{ performedAt: "desc" }, { recordedAt: "desc" }],
      take: LIST_LIMIT,
      include: {
        deviceDuty: { select: { title: true, dutyKey: true } },
        inspectionRun: {
          select: {
            id: true,
            reportBlobId: true,
            reportSha256: true,
            catalogue: { select: { label: true } },
          },
        },
      },
    });

    const reports: DeviceReportDTO[] = rows.map((r) => {
      const run = r.inspectionRun;
      const hasReport = Boolean(run?.reportBlobId || r.attachmentBlobId);
      return {
        performanceId: r.id,
        runId: run?.id ?? null,
        dutyTitle: r.deviceDuty.title ?? r.deviceDuty.dutyKey,
        catalogueLabel: run?.catalogue.label ?? null,
        source: r.source,
        result: r.result,
        performedAt: r.performedAt.toISOString().slice(0, 10),
        performedBy: r.performedBy,
        hasReport,
        reportUrl: hasReport
          ? reportUrlFor({ runId: run?.id ?? null, attachmentBlobId: r.attachmentBlobId })
          : null,
        reportSha256: run?.reportSha256 ?? null,
        acknowledged: Boolean(r.acknowledgedAt),
        acknowledgedBy: r.acknowledgedBy,
        acknowledgedAt: r.acknowledgedAt?.toISOString() ?? null,
      };
    });
    return {
      reports,
      unacknowledgedCount: reports.filter((r) => r.runId && !r.acknowledged).length,
    };
  },

  /** Sealed reports (inspection runs) the clinic has not acknowledged yet. */
  async countUnacknowledged(): Promise<number> {
    return prisma.dutyPerformance.count({
      where: { acknowledgedAt: null, inspectionRun: { isNot: null } },
    });
  },

  /** Clinic-wide list for /reports/pending (E106 tile destination). */
  async listUnacknowledged(ctx: TenantWorkContext): Promise<PendingReportsDTO> {
    requirePermission(ctx, "inventory:view");
    const rows = await prisma.dutyPerformance.findMany({
      where: {
        tenantId: ctx.tenantId,
        acknowledgedAt: null,
        inspectionRun: { isNot: null },
      },
      orderBy: [{ performedAt: "desc" }, { recordedAt: "desc" }],
      take: LIST_LIMIT,
      include: {
        deviceDuty: {
          select: {
            title: true,
            dutyKey: true,
            deviceInstanceId: true,
            deviceInstance: {
              select: {
                inventoryNumber: true,
                model: { select: { manufacturer: true, tradeName: true, modelName: true } },
              },
            },
          },
        },
        inspectionRun: {
          select: {
            id: true,
            reportBlobId: true,
            reportSha256: true,
            catalogue: { select: { label: true } },
          },
        },
      },
    });

    const reports: PendingReportDTO[] = rows.map((r) => {
      const run = r.inspectionRun;
      const device = r.deviceDuty.deviceInstance;
      const hasReport = Boolean(run?.reportBlobId || r.attachmentBlobId);
      const modelName = device.model
        ? [device.model.manufacturer, device.model.tradeName ?? device.model.modelName]
            .filter(Boolean)
            .join(" ")
        : null;
      return {
        performanceId: r.id,
        runId: run?.id ?? null,
        dutyTitle: r.deviceDuty.title ?? r.deviceDuty.dutyKey,
        catalogueLabel: run?.catalogue.label ?? null,
        source: r.source,
        result: r.result,
        performedAt: r.performedAt.toISOString().slice(0, 10),
        performedBy: r.performedBy,
        hasReport,
        reportUrl: hasReport
          ? reportUrlFor({ runId: run?.id ?? null, attachmentBlobId: r.attachmentBlobId })
          : null,
        reportSha256: run?.reportSha256 ?? null,
        acknowledged: false,
        acknowledgedBy: null,
        acknowledgedAt: null,
        deviceInstanceId: r.deviceDuty.deviceInstanceId,
        inventoryNumber: device.inventoryNumber,
        deviceName: modelName,
      };
    });

    return { reports, count: reports.length };
  },

  async acknowledge(
    ctx: TenantWorkContext,
    performanceId: string,
    input?: { note?: string | null },
  ): Promise<AcknowledgePerformanceResultDTO> {
    requirePermission(ctx, "requests:approve");
    if (ctx.user.accountKind === "partner") throw forbidden();

    const perf = await prisma.dutyPerformance.findFirst({
      where: { id: performanceId, tenantId: ctx.tenantId },
      include: {
        inspectionRun: {
          select: {
            id: true,
            deviceInstanceId: true,
            serviceRequest: { select: { reference: true } },
          },
        },
        deviceDuty: {
          select: {
            deviceInstanceId: true,
            title: true,
            deviceInstance: { select: { inventoryNumber: true } },
          },
        },
      },
    });
    if (!perf) throw notFound("Performance not found.");

    if (perf.acknowledgedAt) {
      return {
        performanceId: perf.id,
        acknowledgedBy: perf.acknowledgedBy ?? "",
        acknowledgedAt: perf.acknowledgedAt.toISOString(),
      };
    }

    const now = new Date();
    const updated = await prisma.dutyPerformance.update({
      where: { id: perf.id },
      data: {
        acknowledgedBy: ctx.user.name,
        acknowledgedByUserId: ctx.user.id,
        acknowledgedAt: now,
      },
    });

    await recordAudit({
      actor: actorFromContext(ctx),
      resource: "duty_performance",
      resourceId: perf.id,
      action: "acknowledge",
      summary: `Report acknowledged (${perf.deviceDuty.title ?? "duty"})`,
      after: { acknowledgedAt: now.toISOString(), note: input?.note?.trim() || null },
    });

    // Close the inbox items of the clinic ("report_received") and tell the performer.
    if (perf.inspectionRun) {
      await prisma.userNotification
        .updateMany({
          where: {
            dedupKey: notificationDedup.reportReceived(perf.inspectionRun.id),
            state: { not: "done" },
          },
          data: { state: "done", doneAt: now, readAt: now },
        })
        .catch(() => undefined);
    }
    if (perf.performedByUserId && perf.performedByUserId !== ctx.user.id) {
      const requestRef = perf.inspectionRun?.serviceRequest?.reference?.trim();
      const inv = perf.deviceDuty.deviceInstance?.inventoryNumber ?? null;
      await notifyService.pushSafe(
        perf.performedByUserId,
        "follow_up",
        notificationDedup.reportAcknowledged(perf.id),
        "Prüfbericht bestätigt",
        `${ctx.user.name} hat den Bericht „${perf.deviceDuty.title ?? "Prüfung"}“ bestätigt.`,
        requestRef
          ? { type: "request", id: requestRef }
          : {
              type: "device",
              id: perf.deviceDuty.deviceInstanceId,
              inventoryNumber: inv ?? undefined,
              tenantId: ctx.tenantId,
              focus: "reports",
            },
        ctx.tenantId,
        null,
      );
    }

    return {
      performanceId: updated.id,
      acknowledgedBy: updated.acknowledgedBy ?? ctx.user.name,
      acknowledgedAt: (updated.acknowledgedAt ?? now).toISOString(),
    };
  },
};
