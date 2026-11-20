/**
 * E89/E85 / R40 — Sachverständigenprüfung as external fulfilment + certificate intake.
 */
import type { TenantWorkContext } from "@/interfaces";
import { actorFromContext } from "@/lib/auth/actorContext";
import { requirePermission } from "@/lib/auth/tenantContext";
import { notFound, unprocessable } from "@/lib/errors";
import { requireRadiationDguvEnabled } from "@/lib/features/radiationDguv";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import { computeDutyDueAt } from "@/services/registration/dueDate";

async function requireFlag(ctx: TenantWorkContext) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { featureFlags: true },
  });
  requireRadiationDguvEnabled(tenant?.featureFlags);
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}

export const svExternalService = {
  async commission(
    ctx: TenantWorkContext,
    reference: string,
    input: { externalOrgName: string; externalCommissionedAt: string },
  ) {
    requirePermission(ctx, "requests:approve");
    await requireFlag(ctx);
    const sr = await prisma.serviceRequest.findFirst({
      where: { reference, tenantId: ctx.tenantId },
    });
    if (!sr) throw notFound("Service request not found");
    if (!input.externalOrgName.trim()) {
      throw unprocessable("externalOrgName required", { field: "externalOrgName" });
    }
    const commissionedAt = new Date(`${input.externalCommissionedAt}T00:00:00.000Z`);
    const updated = await prisma.serviceRequest.update({
      where: { id: sr.id },
      data: {
        fulfilment: "external",
        assigneeUserId: null,
        visitId: null,
        externalOrgName: input.externalOrgName.trim(),
        externalCommissionedAt: commissionedAt,
      },
    });
    await recordAudit({
      actor: actorFromContext(ctx),
      resource: "ServiceRequest",
      resourceId: updated.id,
      action: "sv_external_commission",
      summary: `SV Fremdleistung · ${input.externalOrgName.trim()}`,
    });
    return updated;
  },

  async intakeCertificate(
    ctx: TenantWorkContext,
    reference: string,
    input: {
      externalCertificateRef: string;
      externalCertificateDate: string;
      externalCertificateBlobId: string;
      externalResult: "passed" | "objected";
      externalDefectsText?: string | null;
      externalOrgName?: string | null;
    },
  ) {
    requirePermission(ctx, "requests:approve");
    await requireFlag(ctx);

    if (!input.externalCertificateBlobId?.trim()) {
      throw unprocessable("Certificate attachment required", {
        field: "externalCertificateBlobId",
      });
    }
    if (!input.externalCertificateRef?.trim()) {
      throw unprocessable("Certificate number required", {
        field: "externalCertificateRef",
      });
    }
    if (input.externalResult === "objected" && !input.externalDefectsText?.trim()) {
      throw unprocessable("Defects text required when objected", {
        field: "externalDefectsText",
      });
    }

    const sr = await prisma.serviceRequest.findFirst({
      where: { reference, tenantId: ctx.tenantId },
      include: { duty: true },
    });
    if (!sr) throw notFound("Service request not found");

    const certDate = new Date(`${input.externalCertificateDate}T00:00:00.000Z`);
    const office =
      input.externalOrgName?.trim() || sr.externalOrgName || "Sachverständigenbüro";
    const retentionUntil = addMonths(certDate, 120); // 10 years
    const actor = actorFromContext(ctx);

    const result = await prisma.$transaction(async (tx) => {
      await tx.serviceRequest.update({
        where: { id: sr.id },
        data: {
          fulfilment: "external",
          externalOrgName: office,
          externalCertificateRef: input.externalCertificateRef.trim(),
          externalCertificateDate: certDate,
          externalCertificateBlobId: input.externalCertificateBlobId.trim(),
          externalResult: input.externalResult,
          externalDefectsText: input.externalDefectsText?.trim() || null,
          state: "completed",
        },
      });

      await tx.statusEvent.create({
        data: {
          tenantId: ctx.tenantId,
          serviceRequestId: sr.id,
          state: "completed",
          source: "sv_certificate",
          actor: actor.actorName || ctx.user.id,
          note: `SV Bescheinigung ${input.externalCertificateRef.trim()} · ${input.externalResult}`,
        },
      });

      if (sr.duty && sr.duty.dutyKey === "sv") {
        const nextDue = computeDutyDueAt({
          deadlineAnchor: sr.duty.deadlineAnchor,
          referenceDate: sr.duty.referenceDate,
          lastCompletedAt: certDate,
          intervalValue: 60,
          intervalUnit: "months",
        }) ?? addMonths(certDate, 60);

        await tx.dutyPerformance.create({
          data: {
            tenantId: ctx.tenantId,
            deviceDutyId: sr.duty.id,
            serviceRequestId: sr.id,
            performedAt: certDate,
            result: input.externalResult === "passed" ? "passed" : "failed",
            note: input.externalDefectsText?.trim() || null,
            performedBy: office,
            performedByUserId: null,
            source: "external",
            attachmentBlobId: input.externalCertificateBlobId.trim(),
            retentionUntil,
          },
        });

        await tx.deviceDuty.update({
          where: { id: sr.duty.id },
          data: {
            lastCompletedAt: certDate,
            dueAt: nextDue,
            intervalValue: 60,
            intervalUnit: "months",
            notifyStage: null,
            lastNotifiedAt: null,
          },
        });
      }

      return { retentionUntil, office };
    });

    await recordAudit({
      actor,
      resource: "ServiceRequest",
      resourceId: sr.id,
      action: "sv_certificate_intake",
      summary: `SV certificate ${input.externalCertificateRef} · ${input.externalResult}`,
    });

    return {
      reference,
      externalResult: input.externalResult,
      retentionUntil: result.retentionUntil.toISOString().slice(0, 10),
      office: result.office,
    };
  },
};
