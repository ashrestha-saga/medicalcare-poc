import type { DeviceIncidentDTO, TenantContext } from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { actorFromTenant } from "@/lib/auth/actorContext";
import { badRequest, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import type {
  AssessIncidentInput,
  AssignIncidentInput,
  CreateIncidentInput,
  ReportIncidentInput,
} from "@/schemas/k10";
import type { UserRole } from "@/interfaces/session";
import {
  AREA_UNSCOPED_ROLES,
  assertDeviceInWorkAreas,
  getEffectiveAreaScope,
} from "@/services/users/userAreaScope";
import { actorAttribution, recordedByAttribution } from "@/lib/auth/attribution";
import { authorityNotificationService } from "@/services/authority/authorityNotificationService";

function isoDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function deviceLabel(row: {
  deviceInstance?: {
    inventoryNumber: string;
    model?: { tradeName: string | null; modelName: string | null } | null;
  } | null;
}): string | null {
  const m = row.deviceInstance?.model;
  if (!m) return null;
  return m.tradeName || m.modelName || null;
}

function mapIncident(row: {
  id: string;
  deviceInstanceId: string | null;
  deviceModelId: string | null;
  occurredAt: Date;
  noticedAt: Date;
  description: string;
  harmDescription: string | null;
  suspectedSerious: boolean | null;
  assessedBy: string | null;
  assessedAt: Date | null;
  assessmentNote: string | null;
  reportedAt: Date | null;
  reportReference: string | null;
  reportedTo: string | null;
  manufacturerNotifiedAt: Date | null;
  measureTaken: string | null;
  closedAt: Date | null;
  closedBy: string | null;
  recordedBy: string;
  recordedAt: Date;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  assignedAt?: Date | null;
  assignmentDueAt?: Date | null;
  deviceInstance?: {
    inventoryNumber: string;
    model?: { tradeName: string | null; modelName: string | null } | null;
  } | null;
}): DeviceIncidentDTO {
  return {
    id: row.id,
    deviceInstanceId: row.deviceInstanceId,
    inventoryNumber: row.deviceInstance?.inventoryNumber ?? null,
    deviceLabel: deviceLabel(row),
    deviceModelId: row.deviceModelId,
    occurredAt: isoDate(row.occurredAt)!,
    noticedAt: isoDate(row.noticedAt)!,
    description: row.description,
    harmDescription: row.harmDescription,
    suspectedSerious: row.suspectedSerious,
    assessedBy: row.assessedBy,
    assessedAt: isoDate(row.assessedAt),
    assessmentNote: row.assessmentNote,
    reportedAt: isoDate(row.reportedAt),
    reportReference: row.reportReference,
    reportedTo: row.reportedTo,
    manufacturerNotifiedAt: isoDate(row.manufacturerNotifiedAt),
    measureTaken: row.measureTaken,
    closedAt: isoDate(row.closedAt),
    closedBy: row.closedBy,
    recordedBy: row.recordedBy,
    recordedAt: row.recordedAt.toISOString(),
    assignedUserId: row.assignedUserId ?? null,
    assignedUserName: row.assignedUserName ?? null,
    assignedAt: row.assignedAt?.toISOString() ?? null,
    assignmentDueAt: isoDate(row.assignmentDueAt),
  };
}

export type IncidentListView = "all" | "unassessed" | "unreported" | "open";

export type IncidentKpis = {
  unassessed: number;
  unreported: number;
  total: number;
};

function isAreaBypassed(ctx: TenantContext): boolean {
  const role = ctx.user.role as UserRole | null;
  return Boolean(role && (AREA_UNSCOPED_ROLES as readonly string[]).includes(role));
}

async function areaFilter(
  ctx: TenantContext,
): Promise<{ deviceInstance: { areaId: { in: string[] } } } | undefined | "none"> {
  if (isAreaBypassed(ctx) || ctx.permissions?.includes("incidents:manage")) return undefined;
  const scope = await getEffectiveAreaScope(ctx);
  if (scope.mode === "none") return "none";
  if (scope.mode === "areas") {
    return { deviceInstance: { areaId: { in: scope.areaIds } } };
  }
  return undefined;
}

const deviceInclude = {
  deviceInstance: {
    select: {
      inventoryNumber: true,
      model: { select: { tradeName: true, modelName: true } },
    },
  },
} as const;

export const incidentService = {
  async list(
    ctx: TenantContext,
    view: IncidentListView = "all",
  ): Promise<{ incidents: DeviceIncidentDTO[]; kpis: IncidentKpis }> {
    requirePermission(ctx, "incidents:view");
    const viewWhere =
      view === "unassessed"
        ? { suspectedSerious: null, closedAt: null }
        : view === "unreported"
          ? { suspectedSerious: true, reportedAt: null, closedAt: null }
          : view === "open"
            ? { closedAt: null }
            : {};

    const areaWhere = await areaFilter(ctx);
    if (areaWhere === "none") {
      return { incidents: [], kpis: { unassessed: 0, unreported: 0, total: 0 } };
    }

    const base = areaWhere ?? {};
    const [rows, unassessed, unreported, total] = await Promise.all([
      prisma.deviceIncident.findMany({
        where: { ...viewWhere, ...base },
        include: deviceInclude,
        orderBy: [{ occurredAt: "desc" }, { recordedAt: "desc" }],
        take: 500,
      }),
      prisma.deviceIncident.count({
        where: { suspectedSerious: null, closedAt: null, ...base },
      }),
      prisma.deviceIncident.count({
        where: { suspectedSerious: true, reportedAt: null, closedAt: null, ...base },
      }),
      prisma.deviceIncident.count({ where: { ...base } }),
    ]);
    return { incidents: rows.map(mapIncident), kpis: { unassessed, unreported, total } };
  },

  async create(ctx: TenantContext, input: CreateIncidentInput): Promise<DeviceIncidentDTO> {
    requirePermission(ctx, "incidents:manage");
    if (!input.deviceInstanceId && !input.deviceModelId) {
      throw badRequest("Provide deviceInstanceId or deviceModelId");
    }
    if (input.deviceInstanceId) {
      const device = await prisma.deviceInstance.findFirst({
        where: { id: input.deviceInstanceId },
        select: { areaId: true },
      });
      if (!device) throw badRequest("Unknown device instance");
      await assertDeviceInWorkAreas(ctx, device.areaId);
    }
    const row = await prisma.deviceIncident.create({
      data: {
        tenantId: ctx.tenantId,
        deviceInstanceId: input.deviceInstanceId ?? null,
        deviceModelId: input.deviceModelId ?? null,
        occurredAt: new Date(`${input.occurredAt}T00:00:00.000Z`),
        noticedAt: new Date(`${input.noticedAt}T00:00:00.000Z`),
        description: input.description,
        harmDescription: input.harmDescription ?? null,
        measureTaken: input.measureTaken ?? null,
        ...recordedByAttribution(ctx),
      },
      include: deviceInclude,
    });
    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "DeviceIncident",
      resourceId: row.id,
      action: "create",
      summary: "Incident recorded",
    });
    return mapIncident(row);
  },

  async assess(ctx: TenantContext, id: string, input: AssessIncidentInput): Promise<DeviceIncidentDTO> {
    requirePermission(ctx, "incidents:manage");
    const existing = await prisma.deviceIncident.findFirst({ where: { id } });
    if (!existing) throw notFound("Incident not found");
    const assessor = actorAttribution(ctx);
    const row = await prisma.deviceIncident.update({
      where: { id },
      data: {
        suspectedSerious: input.suspectedSerious,
        assessmentNote: input.assessmentNote ?? null,
        assessedBy: assessor.name,
        assessedByUserId: assessor.userId,
        assessedAt: new Date(),
      },
      include: deviceInclude,
    });
    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "DeviceIncident",
      resourceId: id,
      action: "assess",
      summary: `Assessed suspectedSerious=${input.suspectedSerious}`,
      after: { suspectedSerious: input.suspectedSerious },
    });
    return mapIncident(row);
  },

  async report(ctx: TenantContext, id: string, input: ReportIncidentInput): Promise<DeviceIncidentDTO> {
    requirePermission(ctx, "incidents:manage");
    const existing = await prisma.deviceIncident.findFirst({ where: { id } });
    if (!existing) throw notFound("Incident not found");
    if (existing.suspectedSerious !== true) {
      throw badRequest("Only suspected-serious incidents require authority reporting");
    }

    // Authoritative record; stamps on DeviceIncident stay as dashboard convenience.
    await authorityNotificationService.recordIncidentReport(ctx, {
      incidentId: id,
      recipientName: input.reportedTo?.trim() || "BfArM",
      channel: input.channel ?? "authority_portal",
      subject: `Vorkommnismeldung ${id}`,
      bodyText: existing.description,
      sentAt: input.reportedAt,
      reference: input.reportReference ?? null,
    });

    const row = await prisma.deviceIncident.update({
      where: { id },
      data: {
        reportedAt: new Date(`${input.reportedAt}T00:00:00.000Z`),
        reportReference: input.reportReference ?? null,
        reportedTo: input.reportedTo ?? null,
        manufacturerNotifiedAt: input.manufacturerNotifiedAt
          ? new Date(`${input.manufacturerNotifiedAt}T00:00:00.000Z`)
          : null,
      },
      include: deviceInclude,
    });
    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "DeviceIncident",
      resourceId: id,
      action: "report",
      summary: "Incident reported to authority",
    });
    return mapIncident(row);
  },

  async close(ctx: TenantContext, id: string): Promise<DeviceIncidentDTO> {
    requirePermission(ctx, "incidents:manage");
    const existing = await prisma.deviceIncident.findFirst({ where: { id } });
    if (!existing) throw notFound("Incident not found");
    if (existing.suspectedSerious === true && !existing.reportedAt) {
      throw badRequest("Report suspected-serious incidents before closing");
    }
    const closer = actorAttribution(ctx);
    const row = await prisma.deviceIncident.update({
      where: { id },
      data: {
        closedAt: new Date(),
        closedBy: closer.name,
        closedByUserId: closer.userId,
      },
      include: deviceInclude,
    });
    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "DeviceIncident",
      resourceId: id,
      action: "close",
      summary: "Incident closed",
    });
    return mapIncident(row);
  },

  async assign(ctx: TenantContext, id: string, input: AssignIncidentInput): Promise<DeviceIncidentDTO> {
    requirePermission(ctx, "incidents:manage");
    const existing = await prisma.deviceIncident.findFirst({ where: { id } });
    if (!existing) throw notFound("Incident not found");
    const user = await prisma.user.findFirst({
      where: { id: input.assignedUserId, tenantId: ctx.tenantId, active: true },
      select: { id: true, name: true },
    });
    if (!user) throw badRequest("Unknown assignee");
    const row = await prisma.deviceIncident.update({
      where: { id },
      data: {
        assignedUserId: user.id,
        assignedUserName: user.name,
        assignedAt: new Date(),
        assignmentDueAt: input.dueAt ? new Date(`${input.dueAt}T00:00:00.000Z`) : null,
      },
      include: deviceInclude,
    });
    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "DeviceIncident",
      resourceId: id,
      action: "assign",
      summary: `Assigned to ${user.name}`,
      after: { assignedUserId: user.id },
    });
    return mapIncident(row);
  },
};
