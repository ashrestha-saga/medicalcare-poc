import type {
  DueDateRowDTO,
  DueDatesBoardDTO,
  DueDatesListQuery,
  TenantWorkContext,
} from "@/interfaces";
import { OPEN_REQUEST_STATES } from "@/constants/serviceRequest";
import { requirePermission } from "@/lib/auth/tenantContext";
import { notFound, unprocessable } from "@/lib/errors";
import { deriveMaintenanceStatus } from "@/lib/maintenance/schedule";
import { prisma } from "@/lib/prisma";
import type { CreateDutyAssignmentInput } from "@/schemas/dueDates";
import { serviceRequestService } from "@/services/requests/serviceRequestService";
import type { DutyKey, Prisma, ServiceRequestState } from "@prisma/client";
import { confidenceLabel, deadlineAnchorLabel, serviceTypeForDuty } from "./dutyDisplay";

/** Open assignments on the due-dates board (includes scheduled appointments). */
const BOARD_OPEN_STATES = [
  ...OPEN_REQUEST_STATES,
  "scheduled",
] as const satisfies readonly ServiceRequestState[];

const OPEN_ASSIGNMENT_SOME: Prisma.ServiceRequestListRelationFilter = {
  some: { state: { in: [...BOARD_OPEN_STATES] } },
};

const OPEN_ASSIGNMENT_NONE: Prisma.ServiceRequestListRelationFilter = {
  none: { state: { in: [...BOARD_OPEN_STATES] } },
};

function startOfTodayUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400000);
}

function dutyStatus(dueAt: Date | null): DueDateRowDTO["status"] {
  return deriveMaintenanceStatus(dueAt);
}

function deviceTitle(
  model: { tradeName: string | null; modelName: string | null } | null,
  inventoryNumber: string,
) {
  return model?.tradeName?.trim() || model?.modelName?.trim() || inventoryNumber;
}

/**
 * Shared scopes (duty key, horizon, confidence, …) — used for KPI cards so
 * counts stay stable while a status chip is active.
 */
function buildBaseDutyWhere(
  tenantId: string,
  query: DueDatesListQuery = {},
): Prisma.DeviceDutyWhereInput {
  const today = startOfTodayUtc();
  const where: Prisma.DeviceDutyWhereInput = {
    tenantId,
    applicable: true,
    suspendedAt: null,
  };

  if (query.dutyId) {
    where.id = query.dutyId;
    return where;
  }

  if (query.dutyKey) {
    where.dutyKey = query.dutyKey as DutyKey;
  }

  if (query.horizon != null && query.horizon > 0) {
    const end = addDays(today, query.horizon);
    where.dueAt = { gte: today, lte: end };
  } else if (query.scheduled || query.confidence === "unverified") {
    // Board tiles that require a calendar deadline (and unverified-with-due).
    where.dueAt = { not: null };
  }

  if (query.confidence === "unverified") {
    where.confidence = { not: "verified" };
  } else if (query.confidence) {
    where.confidence = query.confidence;
  }

  return where;
}

/**
 * Apply status chip in SQL so pagination does not walk overdue rows first and
 * then discard them in memory (empty `?filter=due` pages).
 */
function applyStatusFilterToWhere(
  base: Prisma.DeviceDutyWhereInput,
  filter: DueDatesListQuery["filter"] | undefined,
  today: Date,
): Prisma.DeviceDutyWhereInput {
  if (!filter || filter === "all") return base;

  if (filter === "due") {
    // Align with card: today or later (status due|ok). Respect an existing horizon window.
    const existing = base.dueAt;
    if (existing && typeof existing === "object" && "lte" in existing) {
      return { ...base, dueAt: { gte: today, lte: (existing as { lte: Date }).lte } };
    }
    return { ...base, dueAt: { gte: today } };
  }

  if (filter === "overdue") {
    return { ...base, dueAt: { lt: today } };
  }

  if (filter === "unassigned") {
    return { ...base, serviceRequests: OPEN_ASSIGNMENT_NONE };
  }

  if (filter === "open") {
    return { ...base, serviceRequests: OPEN_ASSIGNMENT_SOME };
  }

  return base;
}

/** Post-filter safety net (soft-joined assignments / search path). */
function matchesStatusFilter(
  row: DueDateRowDTO,
  filter: DueDatesListQuery["filter"] | undefined,
): boolean {
  if (!filter || filter === "all") return true;
  if (filter === "due") return row.status === "due" || row.status === "ok";
  if (filter === "overdue") return row.status === "overdue";
  if (filter === "unassigned") return row.assignment == null;
  return row.assignment != null;
}

function matchesSearch(row: DueDateRowDTO, q: string | undefined): boolean {
  if (!q?.trim()) return true;
  const needle = q.trim().toLowerCase();
  return [
    row.deviceName,
    row.inventoryNumber,
    row.inspectionTypeLabel,
    row.dutyKey,
    row.basisText,
    row.deadlineAnchorLabel,
    row.assignment?.reference ?? "",
  ]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

const DEFAULT_PAGE_LIMIT = 100;
const MAX_PAGE_LIMIT = 300;

export const dueDatesService = {
  async listBoard(ctx: TenantWorkContext, query: DueDatesListQuery = {}): Promise<DueDatesBoardDTO> {
    requirePermission(ctx, "duties:view");

    const limit = Math.min(Math.max(query.limit ?? DEFAULT_PAGE_LIMIT, 1), MAX_PAGE_LIMIT);
    const offset = Math.max(query.offset ?? 0, 0);
    const today = startOfTodayUtc();
    const baseWhere = buildBaseDutyWhere(ctx.tenantId, query);
    const where = applyStatusFilterToWhere(baseWhere, query.filter, today);

    const [rows, totalMatching, overdueCount, dueOrOkCount, unassignedCount, openAssignmentCount] =
      await Promise.all([
        prisma.deviceDuty.findMany({
          where,
          include: {
            deviceInstance: {
              include: {
                model: { select: { tradeName: true, modelName: true } },
                area: { include: { site: true } },
              },
            },
          },
          orderBy: [{ dueAt: "asc" }, { dutyKey: "asc" }],
          take: limit,
          skip: offset,
        }),
        prisma.deviceDuty.count({ where }),
        // KPIs from base scope (ignore active status chip) so cards stay stable.
        prisma.deviceDuty.count({ where: { ...baseWhere, dueAt: { lt: today } } }),
        prisma.deviceDuty.count({ where: { ...baseWhere, dueAt: { gte: today } } }),
        prisma.deviceDuty.count({
          where: { ...baseWhere, serviceRequests: OPEN_ASSIGNMENT_NONE },
        }),
        prisma.deviceDuty.count({
          where: { ...baseWhere, serviceRequests: OPEN_ASSIGNMENT_SOME },
        }),
      ]);

    const dutyIds = rows.map((r) => r.id);
    const instanceIds = [...new Set(rows.map((r) => r.deviceInstanceId))];

    const openByDuty =
      dutyIds.length === 0
        ? []
        : await prisma.serviceRequest.findMany({
            where: {
              tenantId: ctx.tenantId,
              dutyId: { in: dutyIds },
              state: { in: [...BOARD_OPEN_STATES] },
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
              state: { in: [...BOARD_OPEN_STATES] },
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
        dutyKey: row.dutyKey,
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

    // Search remains in-memory; status chip is already in SQL (keep as safety net for soft joins).
    const filtered = mapped
      .filter((row) => matchesSearch(row, query.q))
      .filter((row) => matchesStatusFilter(row, query.filter));

    const summary = {
      due: dueOrOkCount,
      overdue: overdueCount,
      unassigned: unassignedCount,
      openAssignments: openAssignmentCount,
    };

    return {
      summary,
      rows: filtered,
      totalMatching,
      hasMore: offset + rows.length < totalMatching,
      limit,
      offset,
    };
  },

  async createAssignment(ctx: TenantWorkContext, dutyId: string, input?: CreateDutyAssignmentInput) {
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
