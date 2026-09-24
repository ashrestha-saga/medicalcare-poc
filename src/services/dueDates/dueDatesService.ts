import type { DueDateRowDTO, DueDatesBoardDTO, TenantContext } from "@/interfaces";
import { OPEN_REQUEST_STATES } from "@/constants/serviceRequest";
import { requirePermission } from "@/lib/auth/tenantContext";
import { notFound, unprocessable } from "@/lib/errors";
import { deriveMaintenanceStatus } from "@/lib/maintenance/schedule";
import { prisma } from "@/lib/prisma";
import type { CreateDutyAssignmentInput } from "@/schemas/dueDates";
import { serviceRequestService } from "@/services/requests/serviceRequestService";
import { confidenceLabel, deadlineAnchorLabel, serviceTypeForDuty } from "./dutyDisplay";

const OPEN_SET = new Set<string>(OPEN_REQUEST_STATES);

function dutyStatus(dueAt: Date | null): DueDateRowDTO["status"] {
  return deriveMaintenanceStatus(dueAt);
}

function deviceTitle(
  model: { tradeName: string | null; modelName: string | null } | null,
  inventoryNumber: string,
) {
  return model?.tradeName?.trim() || model?.modelName?.trim() || inventoryNumber;
}

export const dueDatesService = {
  async listBoard(ctx: TenantContext): Promise<DueDatesBoardDTO> {
    requirePermission(ctx, "duties:view");

    const rows = await prisma.deviceDuty.findMany({
      where: { tenantId: ctx.tenantId, applicable: true, suspendedAt: null },
      include: {
        deviceInstance: {
          include: {
            model: { select: { tradeName: true, modelName: true } },
            area: { include: { site: true } },
          },
        },
      },
      orderBy: [{ dueAt: "asc" }, { dutyKey: "asc" }],
    });

    const dutyIds = rows.map((r) => r.id);
    const instanceIds = [...new Set(rows.map((r) => r.deviceInstanceId))];

    const openByDuty =
      dutyIds.length === 0
        ? []
        : await prisma.serviceRequest.findMany({
            where: {
              tenantId: ctx.tenantId,
              dutyId: { in: dutyIds },
              state: { in: [...OPEN_REQUEST_STATES] },
            },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              reference: true,
              state: true,
              dutyId: true,
              subjectId: true,
              serviceType: true,
            },
          });

    const byDutyId = new Map<string, (typeof openByDuty)[number]>();
    for (const req of openByDuty) {
      if (req.dutyId && !byDutyId.has(req.dutyId)) byDutyId.set(req.dutyId, req);
    }

    // Legacy soft join for older assignments without dutyId
    const openLegacy =
      instanceIds.length === 0
        ? []
        : await prisma.serviceRequest.findMany({
            where: {
              tenantId: ctx.tenantId,
              dutyId: null,
              subjectType: "instance",
              subjectId: { in: instanceIds },
              state: { in: [...OPEN_REQUEST_STATES] },
            },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              reference: true,
              state: true,
              subjectId: true,
              serviceType: true,
            },
          });

    const byInstanceType = new Map<string, (typeof openLegacy)[number]>();
    for (const req of openLegacy) {
      const key = `${req.subjectId}::${req.serviceType}`;
      if (!byInstanceType.has(key)) byInstanceType.set(key, req);
    }

    const mapped: DueDateRowDTO[] = rows.map((row) => {
      const serviceType = serviceTypeForDuty(row.inspectionTypeCode);
      const assignment =
        byDutyId.get(row.id) ??
        byInstanceType.get(`${row.deviceInstanceId}::${serviceType}`) ??
        null;
      const status = dutyStatus(row.dueAt);
      return {
        id: row.id,
        deviceInstanceId: row.deviceInstanceId,
        deviceName: deviceTitle(row.deviceInstance.model, row.deviceInstance.inventoryNumber),
        inventoryNumber: row.deviceInstance.inventoryNumber,
        commissionedAt: row.deviceInstance.commissionedAt?.toISOString() ?? null,
        inspectionTypeCode: row.inspectionTypeCode,
        inspectionTypeLabel: row.title ?? row.dutyKey,
        confidence: row.confidence,
        confidenceLabel: confidenceLabel(row.confidence),
        basisText: row.basisText,
        deadlineAnchor: row.deadlineAnchor,
        deadlineAnchorLabel: deadlineAnchorLabel(row.deadlineAnchor),
        dueAt: row.dueAt?.toISOString() ?? null,
        lastCompletedAt: row.lastCompletedAt?.toISOString() ?? null,
        status,
        assignment: assignment
          ? { id: assignment.id, reference: assignment.reference, state: assignment.state }
          : null,
      };
    });

    const summary = {
      due: mapped.filter((r) => r.status === "due" || r.status === "ok").length,
      overdue: mapped.filter((r) => r.status === "overdue").length,
      unassigned: mapped.filter((r) => !r.assignment).length,
      openAssignments: mapped.filter((r) => r.assignment && OPEN_SET.has(r.assignment.state)).length,
    };

    return { summary, rows: mapped };
  },

  async createAssignment(ctx: TenantContext, dutyId: string, input?: CreateDutyAssignmentInput) {
    requirePermission(ctx, "duties:view");
    requirePermission(ctx, "requests:create");

    const duty = await prisma.deviceDuty.findFirst({
      where: { id: dutyId, tenantId: ctx.tenantId, applicable: true, suspendedAt: null },
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

    const result = await serviceRequestService.create(
      {
        idempotencyKey: `due-assign:${duty.id}`,
        subjectType: "instance",
        subjectId: instance.id,
        serviceType,
        note: input?.note?.trim() || `Due-date assignment: ${title}`,
        site: site.id,
        locationText,
        accessHint: accessParts.join(" · ") || undefined,
        deliveryAddress,
        raisedBy: ctx.user.name,
        source: "due_date",
        dutyId: duty.id,
        deferDispatch: true,
      },
      ctx,
    );

    const board = await this.listBoard(ctx);
    const row = board.rows.find((r) => r.id === duty.id) ?? null;
    return { request: result.request, created: result.created, row };
  },
};
