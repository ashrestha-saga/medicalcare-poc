import type { FaultConsequence, ServiceRequestState } from "@prisma/client";
import type { PartnerContext } from "@/interfaces/session";
import type { ServiceRequestDTO } from "@/interfaces/serviceRequest";
import { REPAIR_SERVICE_TYPE } from "@/constants/repairs";
import { PRIORITIES } from "@/constants/inspectionTypes";
import { intersectPartnerGrantsWithResolvedSlugs } from "@/constants/partnerPermissions";
import { actorFromPartnerOnTenant } from "@/lib/auth/actorContext";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { forbidden, notFound, unprocessable } from "@/lib/errors";
import { requireRepairsEnabled } from "@/lib/features/repairs";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { PartnerCreateOrderInput } from "@/schemas/repairs";
import { assertPartnerManagesTenant } from "@/services/access/partnerAccessService";
import { recordAudit } from "@/services/audit/auditService";
import { ensureExecutorForContract } from "@/services/contracts/executorSyncService";
import { dispatchService } from "@/services/dispatch/dispatchService";
import { transitionOperationalState } from "@/services/repairs/operationalStateService";
import { assertTrainingGateOnCreate } from "@/services/repairs/trainingGateService";
import { serviceRequestService } from "@/services/requests/serviceRequestService";
import { getCachedPartnerActingPermissions } from "@/services/roles/roleGrantsService";
import { createAttachmentFromDataUrl } from "@/services/storage/attachmentBlobService";

export type PartnerCreateOrderResult = {
  request: ServiceRequestDTO | null;
  created: boolean;
  entryId: string | null;
  clarificationId: string | null;
  gateHint: boolean;
};

function urgencyToPriority(
  urgency: PartnerCreateOrderInput["urgency"],
): (typeof PRIORITIES)[number] {
  if (urgency === "immediate") return "critical";
  if (urgency === "at_appointment") return "high";
  return "normal";
}

/**
 * Partner „Auftrag anlegen“ — creates a ServiceRequest already allocated + transmitted
 * to the partner executor (same self-dispatch pattern as due-date assign).
 */
export async function partnerCreateOrder(
  ctx: PartnerContext,
  input: PartnerCreateOrderInput,
): Promise<PartnerCreateOrderResult> {
  return runWithoutTenantAsync(async () => {
    const access = await assertPartnerManagesTenant(
      ctx.user.id,
      ctx.organisationId,
      input.tenantId,
    );
    const actingPerms = intersectPartnerGrantsWithResolvedSlugs(
      getCachedPartnerActingPermissions(access.appRole),
      access.permissionSlugs,
    );
    const granted = new Set(actingPerms);
    if (!granted.has("console:disposition:assign") && !granted.has("requests:create")) {
      throw forbidden();
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: { featureFlags: true },
    });
    requireRepairsEnabled(tenant?.featureFlags);

    const device = await prisma.deviceInstance.findFirst({
      where: { id: input.deviceInstanceId, tenantId: input.tenantId },
      include: {
        model: { select: { manufacturer: true, tradeName: true, modelName: true } },
        area: {
          include: {
            site: { select: { id: true, name: true, address: true, deliveryAddress: true } },
          },
        },
      },
    });
    if (!device) throw notFound("Device not found");
    const site = device.area?.site;
    if (!site) {
      throw unprocessable("Assign a site/area on the device before creating an order.", {
        field: "site",
      });
    }

    let gateHint = false;
    if (input.assigneeUserId) {
      const gateResult = await assertTrainingGateOnCreate({
        organisationId: ctx.organisationId,
        manufacturer: device.model?.manufacturer ?? "",
        assigneeUserId: input.assigneeUserId,
        serviceType: input.serviceType,
      });
      gateHint = gateResult === "hint";
    }

    const locationParts = [site.name, device.area?.name, device.room].filter(Boolean);
    const locationText = locationParts.join(", ") || site.name;
    const deliveryAddress = site.deliveryAddress?.trim() || site.address?.trim() || locationText;
    const priority = urgencyToPriority(input.urgency);

    const workshopNote =
      input.fulfilment === "send_in" && input.workshopName?.trim()
        ? `Werkstatt: ${input.workshopName.trim()}`
        : null;
    const noteParts = [workshopNote, input.note?.trim()].filter(Boolean);
    const note = noteParts.length ? noteParts.join("\n") : undefined;

    const actingCtx = {
      tenantId: input.tenantId,
      user: { ...ctx.user, organisationName: access.organisationName },
      correlationId: ctx.correlationId,
      requestMeta: ctx.requestMeta,
      permissions: actingPerms,
      actor: actorFromPartnerOnTenant(ctx, input.tenantId, access.contractId),
    };

    // Störung + restricted without creating repair SR → book + triage only (clinic parity).
    if (
      input.reason === "stoerung" &&
      input.faultConsequence === "restricted" &&
      input.serviceType === REPAIR_SERVICE_TYPE
    ) {
      const triage = await createStoerungBookOnly(actingCtx, {
        deviceId: device.id,
        inventoryNumber: device.inventoryNumber,
        description: input.faultDescription!.trim(),
        faultSince: input.faultSince,
        consequence: "restricted",
        reportedBy: input.faultReportedBy!.trim(),
        photoDataUrl: input.photoDataUrl,
        triage: true,
      });
      return {
        request: null,
        created: false,
        entryId: triage.entryId,
        clarificationId: triage.clarificationId,
        gateHint,
      };
    }

    if (
      input.reason === "stoerung" &&
      input.faultConsequence === "usable" &&
      input.serviceType === REPAIR_SERVICE_TYPE
    ) {
      const book = await createStoerungBookOnly(actingCtx, {
        deviceId: device.id,
        inventoryNumber: device.inventoryNumber,
        description: input.faultDescription!.trim(),
        faultSince: input.faultSince,
        consequence: "usable",
        reportedBy: input.faultReportedBy!.trim(),
        photoDataUrl: input.photoDataUrl,
        triage: false,
      });
      return {
        request: null,
        created: false,
        entryId: book.entryId,
        clarificationId: null,
        gateHint,
      };
    }

    const result = await serviceRequestService.create(
      {
        idempotencyKey: input.idempotencyKey,
        subjectType: "instance",
        subjectId: device.id,
        serviceType: input.serviceType,
        reason: input.reason,
        priority,
        note,
        site: site.id,
        locationText,
        accessHint: locationParts.join(" · ") || undefined,
        deliveryAddress,
        raisedBy: ctx.user.name,
        source: "app",
        deferDispatch: true,
        // Initial create accepts on_site|send_in; external is applied in the update below.
        fulfilment: input.fulfilment === "external" ? "on_site" : input.fulfilment,
      },
      actingCtx,
    );

    const executor = await ensureExecutorForContract(prisma, {
      tenantId: input.tenantId,
      organisationId: ctx.organisationId,
    });

    let request = result.request;
    const row = await prisma.serviceRequest.findUnique({ where: { id: request.id } });
    if (!row) throw notFound("Service request missing after create.");

    let entryId: string | null = null;

    if (result.created || !row.transmittedAt) {
      const faultSince = input.faultSince
        ? new Date(`${input.faultSince}T00:00:00.000Z`)
        : input.reason === "stoerung"
          ? new Date()
          : null;

      const updateData: Record<string, unknown> = {
        reason: input.reason,
        fulfilment: input.fulfilment,
        priority,
        executorOrgId: executor.id,
        allocatedAt: row.allocatedAt ?? new Date(),
        allocatedBy: row.allocatedBy ?? ctx.user.name,
        assigneeUserId:
          input.fulfilment === "external" ? null : (input.assigneeUserId ?? null),
        visitId: input.fulfilment === "external" ? null : undefined,
        scheduledAt:
          input.fulfilment === "on_site" && input.appointmentAt
            ? new Date(input.appointmentAt)
            : null,
        ...(input.fulfilment === "external"
          ? {
              externalOrgName: input.externalOrgName?.trim() || null,
              externalCommissionedAt: input.externalCommissionedAt
                ? new Date(`${input.externalCommissionedAt}T00:00:00.000Z`)
                : null,
            }
          : {}),
      };

      if (input.reason === "stoerung") {
        updateData.faultDescription = input.faultDescription!.trim();
        updateData.faultSince = faultSince;
        updateData.faultConsequence = input.faultConsequence as FaultConsequence;
        updateData.faultReportedBy = input.faultReportedBy!.trim();

        const book = await createStoerungBookOnly(actingCtx, {
          deviceId: device.id,
          inventoryNumber: device.inventoryNumber,
          description: input.faultDescription!.trim(),
          faultSince: input.faultSince,
          consequence: (input.faultConsequence ?? "out_of_service") as FaultConsequence,
          reportedBy: input.faultReportedBy!.trim(),
          photoDataUrl: input.photoDataUrl,
          triage: false,
        });
        entryId = book.entryId;
        updateData.bookEntryId = book.entryId;

        if (input.faultConsequence === "out_of_service") {
          await transitionOperationalState(actingCtx, {
            deviceInstanceId: device.id,
            to: "locked",
            lockSource: "user",
            note: input.faultDescription!.trim(),
            system: true,
          });
        }
      }

      if (input.photoDataUrl?.trim() && input.reason === "stoerung") {
        try {
          const blob = await createAttachmentFromDataUrl(prisma, {
            tenantId: input.tenantId,
            kind: "fault_photo",
            dataUrl: input.photoDataUrl.trim(),
          });
          await prisma.attachment.create({
            data: {
              tenantId: input.tenantId,
              serviceRequestId: row.id,
              kind: "fault_photo",
              url: `/api/attachments/${blob.id}`,
            },
          });
        } catch (error) {
          logger.warn("partner_create_order.photo_attach_failed", {
            reference: request.reference,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      await prisma.serviceRequest.update({
        where: { id: row.id },
        data: updateData,
      });

      const enabledCount = await prisma.dispatchTarget.count({
        where: {
          tenantId: input.tenantId,
          executorOrgId: executor.id,
          enabled: true,
        },
      });

      let dispatched = false;
      if (enabledCount > 0) {
        try {
          const fresh = await serviceRequestService.getByReference(
            request.reference,
            input.tenantId,
          );
          if (fresh) {
            const outcomes = await dispatchService.dispatch(
              fresh,
              input.tenantId,
              ctx.correlationId,
              ctx.user,
              { executorOrgId: executor.id, updateState: false },
            );
            dispatched = outcomes.some((o) => o.result.success);
          }
        } catch (error) {
          logger.error("partner_create_order.dispatch_failed", {
            correlationId: ctx.correlationId,
            reference: request.reference,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const nextState: ServiceRequestState =
        input.fulfilment === "on_site" && input.appointmentAt
          ? "scheduled"
          : dispatched
            ? "transmitted"
            : "handed_off";

      await prisma.serviceRequest.update({
        where: { id: row.id },
        data: {
          transmittedAt: new Date(),
          state: nextState,
        },
      });
      await prisma.statusEvent.create({
        data: {
          tenantId: input.tenantId,
          serviceRequestId: row.id,
          state: nextState,
          source: "partner_console",
          actor: ctx.user.name,
          note:
            input.fulfilment === "send_in"
              ? `Partner create-order (send-in) to ${executor.name}`
              : dispatched
                ? `Partner create-order dispatched to ${executor.name}`
                : `Partner create-order self-dispatched in-app to ${executor.name}`,
        },
      });
    }

    const fresh = await serviceRequestService.getByReference(request.reference, input.tenantId);
    if (fresh) request = fresh;

    if (result.created) {
      await recordAudit({
        actor: actorFromPartnerOnTenant(ctx, input.tenantId, access.contractId),
        resource: "service_request",
        resourceId: request.id,
        action: "create",
        summary: `Partner created order ${request.reference}`,
        after: {
          reference: request.reference,
          reason: input.reason,
          fulfilment: input.fulfilment,
          serviceType: input.serviceType,
          state: request.state,
        },
      });
    }

    return {
      request,
      created: result.created,
      entryId,
      clarificationId: null,
      gateHint,
    };
  });
}

async function createStoerungBookOnly(
  ctx: {
    tenantId: string;
    user: { id: string; name: string };
    correlationId: string;
  },
  input: {
    deviceId: string;
    inventoryNumber: string;
    description: string;
    faultSince?: string | null;
    consequence: FaultConsequence;
    reportedBy: string;
    photoDataUrl?: string | null;
    triage: boolean;
  },
): Promise<{ entryId: string; clarificationId: string | null }> {
  const occurred = input.faultSince
    ? new Date(`${input.faultSince}T00:00:00.000Z`)
    : new Date();

  return prisma.$transaction(async (tx) => {
    let attachmentBlobId: string | null = null;
    if (input.photoDataUrl?.trim()?.startsWith("data:image/")) {
      const blob = await createAttachmentFromDataUrl(tx, {
        tenantId: ctx.tenantId,
        kind: "fault_photo",
        dataUrl: input.photoDataUrl.trim(),
      });
      attachmentBlobId = blob.id;
    }

    const entry = await tx.deviceBookEntry.create({
      data: {
        tenantId: ctx.tenantId,
        deviceInstanceId: input.deviceId,
        kind: "malfunction",
        occurredAt: occurred,
        description: input.description,
        consequence:
          input.consequence === "out_of_service"
            ? "außer Betrieb"
            : input.consequence === "restricted"
              ? "eingeschränkt nutzbar"
              : "weiter nutzbar",
        consequenceCode: input.consequence,
        attachmentBlobId,
        recordedBy: input.reportedBy,
        recordedByUserId: ctx.user.id,
      },
    });

    if (!input.triage) {
      return { entryId: entry.id, clarificationId: null };
    }

    const clarification = await tx.deviceClarification.create({
      data: {
        tenantId: ctx.tenantId,
        deviceInstanceId: input.deviceId,
        kind: "malfunction_triage",
        field: entry.id,
        label: `Störung sichten: ${input.description.slice(0, 120)}`,
        deferredBy: ctx.user.name,
        deferredAt: new Date(),
      },
    });
    return { entryId: entry.id, clarificationId: clarification.id };
  });
}

/** List released devices for a managed clinic tenant (create-order picker). */
export async function listPartnerClinicDevices(
  ctx: PartnerContext,
  tenantId: string,
  q?: string,
) {
  await assertPartnerManagesTenant(ctx.user.id, ctx.organisationId, tenantId);

  const needle = q?.trim();
  const devices = await prisma.deviceInstance.findMany({
    where: {
      tenantId,
      state: "released",
      ...(needle
        ? {
            OR: [
              { inventoryNumber: { contains: needle } },
              { serialNumber: { contains: needle } },
              { model: { tradeName: { contains: needle } } },
              { model: { modelName: { contains: needle } } },
              { model: { manufacturer: { contains: needle } } },
            ],
          }
        : {}),
    },
    orderBy: { inventoryNumber: "asc" },
    include: {
      model: {
        select: {
          manufacturer: true,
          tradeName: true,
          modelName: true,
        },
      },
      area: {
        select: {
          name: true,
          site: { select: { id: true, name: true } },
        },
      },
    },
  });

  return devices.map((d) => ({
    id: d.id,
    inventoryNumber: d.inventoryNumber,
    serialNumber: d.serialNumber,
    room: d.room,
    operationalState: d.operationalState,
    manufacturer: d.model?.manufacturer ?? null,
    tradeName: d.model?.tradeName ?? null,
    modelName: d.model?.modelName ?? null,
    areaName: d.area?.name ?? null,
    siteId: d.area?.site?.id ?? null,
    siteName: d.area?.site?.name ?? null,
    label: [
      d.inventoryNumber,
      d.model?.tradeName || d.model?.modelName,
      d.area?.site?.name,
    ]
      .filter(Boolean)
      .join(" · "),
  }));
}
