import type { FaultConsequence, Prisma } from "@prisma/client";
import type { TenantContext } from "@/interfaces";
import { actorFromTenant } from "@/lib/auth/actorContext";
import { recordedByAttribution } from "@/lib/auth/attribution";
import { requirePermission } from "@/lib/auth/tenantContext";
import { fingerprint, newReference } from "@/lib/crypto";
import { forbidden, notFound, unprocessable } from "@/lib/errors";
import { isRepairsEnabled } from "@/lib/features/repairs";
import { prisma } from "@/lib/prisma";
import { REPAIR_SERVICE_TYPE } from "@/constants/repairs";
import { recordAudit } from "@/services/audit/auditService";
import { transitionOperationalState } from "@/services/repairs/operationalStateService";
import { createAttachmentFromDataUrl } from "@/services/storage/attachmentBlobService";
import { assertDeviceInWorkAreas } from "@/services/users/userAreaScope";

export type FaultReportInput = {
  deviceInstanceId: string;
  description: string;
  occurredAt: string; // YYYY-MM-DD
  consequenceCode: FaultConsequence;
  faultSince?: string | null;
  attachmentBlobId?: string | null;
  /** Compressed image data URL from clinic form upload/capture. */
  photoDataUrl?: string | null;
  kind?: "malfunction" | "operating_error" | "note";
};

export type FaultReportResult = {
  entryId: string;
  serviceRequestId: string | null;
  serviceRequestReference: string | null;
  clarificationId: string | null;
  operationalState: string;
};

async function assertRepairs(ctx: TenantContext) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { featureFlags: true },
  });
  if (!isRepairsEnabled(tenant?.featureFlags)) {
    throw forbidden("Repairs feature is not enabled for this tenant");
  }
}

/** R9 — fault report → book + lock/order or triage clarification. */
export async function reportFault(
  ctx: TenantContext,
  input: FaultReportInput,
): Promise<FaultReportResult> {
  // Clinic form uses requests:create; scan Störung uses devicebook:view.
  const perms = ctx.permissions ?? [];
  if (!perms.includes("requests:create") && !perms.includes("devicebook:view")) {
    requirePermission(ctx, "requests:create");
  }
  await assertRepairs(ctx);

  const device = await prisma.deviceInstance.findFirst({
    where: { id: input.deviceInstanceId },
    select: {
      id: true,
      areaId: true,
      inventoryNumber: true,
      room: true,
      area: {
        select: {
          siteId: true,
          name: true,
          site: { select: { name: true, address: true, deliveryAddress: true } },
        },
      },
    },
  });
  if (!device) throw notFound("Device not found");
  await assertDeviceInWorkAreas(ctx, device.areaId);

  if (!input.description.trim()) {
    throw unprocessable("Description required", { field: "description" });
  }

  const occurred = new Date(`${input.occurredAt}T00:00:00.000Z`);
  const faultSince = input.faultSince
    ? new Date(`${input.faultSince}T00:00:00.000Z`)
    : occurred;
  const attribution = recordedByAttribution(ctx);
  const outOfService = input.consequenceCode === "out_of_service";

  const result = await prisma.$transaction(async (tx) => {
    let attachmentBlobId = input.attachmentBlobId?.trim() || null;
    const photoDataUrl = input.photoDataUrl?.trim();
    if (photoDataUrl) {
      if (!photoDataUrl.startsWith("data:image/")) {
        throw unprocessable("Photo must be an image data URL.", { field: "photoDataUrl" });
      }
      const blob = await createAttachmentFromDataUrl(tx, {
        tenantId: ctx.tenantId,
        kind: "fault_photo",
        dataUrl: photoDataUrl,
      });
      attachmentBlobId = blob.id;
    }

    const entry = await tx.deviceBookEntry.create({
      data: {
        tenantId: ctx.tenantId,
        deviceInstanceId: device.id,
        kind: input.kind ?? "malfunction",
        occurredAt: occurred,
        description: input.description.trim(),
        consequence:
          input.consequenceCode === "out_of_service"
            ? "außer Betrieb"
            : input.consequenceCode === "restricted"
              ? "eingeschränkt nutzbar"
              : "weiter nutzbar",
        consequenceCode: input.consequenceCode,
        attachmentBlobId,
        ...attribution,
      },
    });

    if (outOfService) {
      await transitionOperationalState(ctx, {
        deviceInstanceId: device.id,
        to: "locked",
        lockSource: "user",
        note: input.description.trim(),
        tx,
      });

      const siteId = device.area?.siteId ?? null;
      const locationText =
        [device.area?.site?.name, device.area?.name, device.room].filter(Boolean).join(" · ") ||
        device.inventoryNumber;
      const deliveryAddress =
        device.area?.site?.deliveryAddress?.trim() ||
        device.area?.site?.address?.trim() ||
        locationText;
      const idempotencyKey = `fault-${entry.id}`;
      const fp = fingerprint({
        tenantId: ctx.tenantId,
        subjectId: device.id,
        serviceType: REPAIR_SERVICE_TYPE,
        bookEntryId: entry.id,
      });

      const sr = await tx.serviceRequest.create({
        data: {
          reference: newReference("SR"),
          idempotencyKey,
          fingerprint: fp,
          tenantId: ctx.tenantId,
          subjectType: "instance",
          subjectId: device.id,
          serviceType: REPAIR_SERVICE_TYPE,
          raisedBy: ctx.user.name,
          raisedById: ctx.user.id,
          siteId,
          locationText,
          deliveryAddress,
          state: "captured",
          source: "report",
          reason: "stoerung",
          faultDescription: input.description.trim(),
          faultSince,
          faultConsequence: input.consequenceCode,
          faultReportedBy: attribution.recordedBy,
          bookEntryId: entry.id,
          statusEvents: {
            create: {
              tenantId: ctx.tenantId,
              state: "captured",
              source: "report",
              actor: ctx.user.name,
              note: "Created from out-of-service fault report",
            },
          },
        },
      });

      return {
        entryId: entry.id,
        serviceRequestId: sr.id,
        serviceRequestReference: sr.reference,
        clarificationId: null as string | null,
        operationalState: "locked",
      };
    }

    // usable → book only; restricted → triage clarification
    if (input.consequenceCode === "usable") {
      return {
        entryId: entry.id,
        serviceRequestId: null,
        serviceRequestReference: null,
        clarificationId: null as string | null,
        operationalState: "in_service",
      };
    }

    const clarification = await tx.deviceClarification.create({
      data: {
        tenantId: ctx.tenantId,
        deviceInstanceId: device.id,
        kind: "malfunction_triage",
        field: entry.id,
        label: `Störung sichten: ${input.description.trim().slice(0, 120)}`,
        deferredBy: ctx.user.name,
        deferredAt: new Date(),
      },
    });

    return {
      entryId: entry.id,
      serviceRequestId: null,
      serviceRequestReference: null,
      clarificationId: clarification.id,
      operationalState: "in_service",
    };
  });

  await recordAudit({
    actor: actorFromTenant(ctx),
    resource: "DeviceBookEntry",
    resourceId: result.entryId,
    action: "fault_report",
    summary: `Fault report for ${device.inventoryNumber}`,
    after: result,
  });

  return result;
}

/** Resolve malfunction_triage → create repair order or close with note. */
export async function resolveMalfunctionTriage(
  ctx: TenantContext,
  clarificationId: string,
  input: { action: "order" | "no_action"; resolutionNote?: string | null },
): Promise<FaultReportResult> {
  requirePermission(ctx, "requests:approve");
  await assertRepairs(ctx);

  const clarification = await prisma.deviceClarification.findFirst({
    where: { id: clarificationId, kind: "malfunction_triage", resolvedAt: null },
  });
  if (!clarification) throw notFound("Clarification not found");

  if (input.action === "no_action") {
    if (!input.resolutionNote?.trim()) {
      throw unprocessable("Reason required when taking no action", { field: "resolutionNote" });
    }
    await prisma.deviceClarification.update({
      where: { id: clarification.id },
      data: {
        resolvedAt: new Date(),
        resolvedBy: ctx.user.name,
        resolutionNote: input.resolutionNote.trim(),
      },
    });
    return {
      entryId: clarification.field ?? "",
      serviceRequestId: null,
      serviceRequestReference: null,
      clarificationId: clarification.id,
      operationalState: "in_service",
    };
  }

  const entryId = clarification.field;
  if (!entryId) throw unprocessable("Triage clarification missing book entry link");

  const entry = await prisma.deviceBookEntry.findFirst({ where: { id: entryId } });
  if (!entry) throw notFound("Book entry not found");

  const device = await prisma.deviceInstance.findFirst({
    where: { id: clarification.deviceInstanceId },
    select: {
      id: true,
      inventoryNumber: true,
      room: true,
      area: {
        select: {
          siteId: true,
          name: true,
          site: { select: { name: true, address: true, deliveryAddress: true } },
        },
      },
    },
  });
  if (!device) throw notFound("Device not found");

  const siteId = device.area?.siteId ?? null;
  const locationText =
    [device.area?.site?.name, device.area?.name, device.room].filter(Boolean).join(" · ") ||
    device.inventoryNumber;
  const deliveryAddress =
    device.area?.site?.deliveryAddress?.trim() ||
    device.area?.site?.address?.trim() ||
    locationText;
  const idempotencyKey = `fault-triage-${entry.id}`;
  const fp = fingerprint({
    tenantId: ctx.tenantId,
    subjectId: device.id,
    serviceType: REPAIR_SERVICE_TYPE,
    bookEntryId: entry.id,
  });

  const sr = await prisma.$transaction(async (tx) => {
    const created = await tx.serviceRequest.create({
      data: {
        reference: newReference("SR"),
        idempotencyKey,
        fingerprint: fp,
        tenantId: ctx.tenantId,
        subjectType: "instance",
        subjectId: device.id,
        serviceType: REPAIR_SERVICE_TYPE,
        raisedBy: ctx.user.name,
        raisedById: ctx.user.id,
        siteId,
        locationText,
        deliveryAddress,
        state: "captured",
        source: "report",
        reason: "stoerung",
        faultDescription: entry.description,
        faultSince: entry.occurredAt,
        faultConsequence: entry.consequenceCode ?? "restricted",
        faultReportedBy: entry.recordedBy,
        bookEntryId: entry.id,
        statusEvents: {
          create: {
            tenantId: ctx.tenantId,
            state: "captured",
            source: "triage",
            actor: ctx.user.name,
            note: "Created from malfunction triage",
          },
        },
      },
    });
    await tx.deviceClarification.update({
      where: { id: clarification.id },
      data: {
        resolvedAt: new Date(),
        resolvedBy: ctx.user.name,
        resolutionNote: input.resolutionNote?.trim() || "Auftrag angelegt",
      },
    });
    return created;
  });

  return {
    entryId: entry.id,
    serviceRequestId: sr.id,
    serviceRequestReference: sr.reference,
    clarificationId: clarification.id,
    operationalState: "in_service",
  };
}
