import type { PartnerContext } from "@/interfaces/session";
import type { ServiceRequestDTO } from "@/interfaces/serviceRequest";
import { actorFromPartnerOnTenant } from "@/lib/auth/actorContext";
import { forbidden, notFound, unprocessable } from "@/lib/errors";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { prisma } from "@/lib/prisma";
import {
  getCachedPartnerActingPermissions,
} from "@/services/roles/roleGrantsService";
import { assertPartnerManagesTenant } from "@/services/access/partnerAccessService";
import { intersectPartnerGrantsWithResolvedSlugs } from "@/constants/partnerPermissions";
import { ensureExecutorForContract } from "@/services/contracts/executorSyncService";
import { serviceTypeForDuty } from "@/services/dueDates/dutyDisplay";
import { serviceRequestService } from "@/services/requests/serviceRequestService";
import { recordAudit } from "@/services/audit/auditService";
import { dispatchService } from "@/services/dispatch/dispatchService";
import type { ServiceRequestState } from "@prisma/client";
import { logger } from "@/lib/logger";

export type PartnerDueDateAssignResult = {
  request: ServiceRequestDTO;
  created: boolean;
};

function dueDateKey(dueAt: Date | null): string {
  if (!dueAt) {
    const n = new Date();
    return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-${String(n.getUTCDate()).padStart(2, "0")}`;
  }
  return dueAt.toISOString().slice(0, 10);
}

/**
 * Version A self-dispatch: partner creates a ServiceRequest already allocated
 * to their executor org and marked transmitted/handed_off so it appears in Disposition.
 */
export const partnerDueDatesAssignService = {
  async assign(
    ctx: PartnerContext,
    dutyId: string,
    input?: { note?: string },
  ): Promise<PartnerDueDateAssignResult> {
    return runWithoutTenantAsync(async () => {
      const duty = await prisma.deviceDuty.findFirst({
        where: { id: dutyId, applicable: true, suspendedAt: null },
        include: {
          deviceInstance: {
            include: {
              model: { select: { tradeName: true, modelName: true } },
              area: { include: { site: true } },
            },
          },
        },
      });
      if (!duty) throw notFound("Duty not found.");

      const access = await assertPartnerManagesTenant(
        ctx.user.id,
        ctx.organisationId,
        duty.tenantId,
      );
      const actingPerms = intersectPartnerGrantsWithResolvedSlugs(
        getCachedPartnerActingPermissions(access.appRole),
        access.permissionSlugs,
      );
      const granted = new Set(actingPerms);
      if (!granted.has("duties:view") || !granted.has("requests:create")) {
        throw forbidden();
      }

      const instance = duty.deviceInstance;
      const site = instance.area?.site;
      if (!site) {
        throw unprocessable("Assign a site/area on the device before creating an assignment.", {
          field: "site",
        });
      }

      const serviceType = serviceTypeForDuty(duty.inspectionTypeCode);
      const locationParts = [site.name, instance.area?.name, instance.room].filter(Boolean);
      const locationText = locationParts.join(", ") || site.name;
      const deliveryAddress = site.deliveryAddress?.trim() || site.address?.trim() || locationText;
      const title = duty.title ?? duty.dutyKey;
      const accessParts = [site.name, instance.area?.name, instance.room].filter(Boolean);
      const idempotencyKey = `duty:${duty.id}:${dueDateKey(duty.dueAt)}`;

      const actingCtx = {
        tenantId: duty.tenantId,
        user: { ...ctx.user, organisationName: access.organisationName },
        correlationId: ctx.correlationId,
        requestMeta: ctx.requestMeta,
        permissions: actingPerms,
        actor: actorFromPartnerOnTenant(ctx, duty.tenantId, access.contractId),
      };

      const result = await serviceRequestService.create(
        {
          idempotencyKey,
          subjectType: "instance",
          subjectId: instance.id,
          serviceType,
          note: input?.note?.trim() || `Partner due-date order: ${title}`,
          site: site.id,
          locationText,
          accessHint: accessParts.join(" · ") || undefined,
          deliveryAddress,
          raisedBy: ctx.user.name,
          source: "due_date",
          dutyId: duty.id,
          deferDispatch: true,
        },
        actingCtx,
      );

      // Ensure reason + self-dispatch allocation even on idempotent replay.
      const executor = await ensureExecutorForContract(prisma, {
        tenantId: duty.tenantId,
        organisationId: ctx.organisationId,
      });

      let request = result.request;
      const row = await prisma.serviceRequest.findUnique({ where: { id: request.id } });
      if (!row) throw notFound("Service request missing after create.");

      if (result.created || !row.transmittedAt) {
        await prisma.serviceRequest.update({
          where: { id: row.id },
          data: {
            reason: "faelligkeit",
            executorOrgId: executor.id,
            allocatedAt: row.allocatedAt ?? new Date(),
            allocatedBy: row.allocatedBy ?? ctx.user.name,
          },
        });

        const enabledCount = await prisma.dispatchTarget.count({
          where: {
            tenantId: duty.tenantId,
            executorOrgId: executor.id,
            enabled: true,
          },
        });

        let dispatched = false;
        if (enabledCount > 0) {
          try {
            const fresh = await serviceRequestService.getByReference(request.reference, duty.tenantId);
            if (fresh) {
              const outcomes = await dispatchService.dispatch(
                fresh,
                duty.tenantId,
                ctx.correlationId,
                ctx.user,
                { executorOrgId: executor.id, updateState: false },
              );
              dispatched = outcomes.some((o) => o.result.success);
            }
          } catch (error) {
            logger.error("partner_due_date.dispatch_failed", {
              correlationId: ctx.correlationId,
              reference: request.reference,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        const nextState: ServiceRequestState = dispatched ? "transmitted" : "handed_off";
        await prisma.serviceRequest.update({
          where: { id: row.id },
          data: { transmittedAt: new Date(), state: nextState },
        });
        await prisma.statusEvent.create({
          data: {
            tenantId: duty.tenantId,
            serviceRequestId: row.id,
            state: nextState,
            source: "partner_console",
            actor: ctx.user.name,
            note: dispatched
              ? `Self-dispatched to ${executor.name}`
              : `Self-dispatched in-app to ${executor.name} — no outbound channel`,
          },
        });
      } else if (row.reason !== "faelligkeit") {
        await prisma.serviceRequest.update({
          where: { id: row.id },
          data: { reason: "faelligkeit" },
        });
      }

      const fresh = await serviceRequestService.getByReference(request.reference, duty.tenantId);
      if (fresh) request = fresh;

      if (result.created) {
        await recordAudit({
          actor: actorFromPartnerOnTenant(ctx, duty.tenantId, access.contractId),
          resource: "service_request",
          resourceId: request.id,
          action: "create",
          summary: `Partner self-dispatched due-date order ${request.reference}`,
          after: {
            reference: request.reference,
            dutyId: duty.id,
            reason: "faelligkeit",
            state: request.state,
          },
        });
      }

      return { request, created: result.created };
    });
  },
};
