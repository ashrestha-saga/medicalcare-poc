import type { PartnerContext } from "@/interfaces/session";
import type {
  ConsoleRequestListDTO,
  ConsoleRequestRowDTO,
  DispositionDisplayState,
  MySitesListDTO,
  SiteAssignmentRowDTO,
  SitePortalDTO,
} from "@/interfaces/console";
import type { DispositionAdvanceParsed, DispositionAssignParsed } from "@/schemas/console";
import { actorFromPartnerOrg } from "@/lib/auth/actorContext";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { forbidden, notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import { isLiveContract } from "@/services/access/partnerAccessService";
import { requirePartnerPermission } from "@/lib/auth/tenantContext";
import { parseAppointmentInput } from "@/lib/format";
import { addMonthsUtc } from "@/lib/maintenance/schedule";
import { computeDutyDueAt } from "@/services/registration/dueDate";
import type { ServiceRequestState } from "@prisma/client";

function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function isoDateTime(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function dispositionHistoryNote(
  next: DispositionDisplayState,
  opts: { assigneeName: string | null; scheduledAt: Date | null },
): string {
  const who = opts.assigneeName?.trim() || null;
  const when = isoDateTime(opts.scheduledAt);
  if (next === "terminiert") {
    const parts = ["Appointment scheduled"];
    if (when) parts.push(`for ${when}`);
    if (who) parts.push(`· assigned to ${who}`);
    return parts.join(" ");
  }
  if (next === "zugewiesen") {
    return who ? `Assigned to ${who}` : "Assigned";
  }
  if (next === "in_arbeit") {
    return who ? `In progress · ${who}` : "In progress";
  }
  return `Disposition advanced to ${next}`;
}

/** Inventory-derived duty due date for portal Due column (not appointment). */
function resolveInventoryDutyDue(
  duty:
    | {
        dueAt: Date | null;
        deadlineAnchor: string;
        referenceDate: Date;
        lastCompletedAt: Date | null;
        intervalValue: number | null;
        intervalUnit: string | null;
      }
    | null
    | undefined,
): Date | null {
  if (!duty) return null;
  if (duty.dueAt) return duty.dueAt;
  const computed = computeDutyDueAt({
    deadlineAnchor: duty.deadlineAnchor,
    referenceDate: duty.referenceDate,
    lastCompletedAt: duty.lastCompletedAt,
    intervalValue: duty.intervalValue,
    intervalUnit: duty.intervalUnit,
  });
  if (computed) return computed;
  // Interval/recurring duties often store dueAt=null; still show next occurrence.
  if (duty.intervalValue != null && duty.intervalUnit) {
    const months =
      duty.intervalUnit === "years"
        ? duty.intervalValue * 12
        : duty.intervalUnit === "months"
          ? duty.intervalValue
          : null;
    if (months != null) {
      return addMonthsUtc(duty.lastCompletedAt ?? duty.referenceDate, months);
    }
  }
  return null;
}

/** Rough proximity from German PLZ Leitbereiche (mockup heuristic). */
export function distanceBandFromPostal(
  depotPlz: string | null | undefined,
  targetPlz: string | null | undefined,
): "nah" | "mittel" | "fern" | "unknown" {
  const a = depotPlz?.replace(/\D/g, "") ?? "";
  const b = targetPlz?.replace(/\D/g, "") ?? "";
  if (a.length < 2 || b.length < 2) return "unknown";
  if (a.slice(0, 3) === b.slice(0, 3)) return "nah";
  if (a.slice(0, 2) === b.slice(0, 2)) return "mittel";
  const d = Math.abs(parseInt(a.slice(0, 2), 10) - parseInt(b.slice(0, 2), 10));
  return d <= 3 ? "mittel" : "fern";
}

const PRE_SCHEDULE: ServiceRequestState[] = [
  "captured",
  "queued",
  "transmitted",
  "acknowledged",
];

export function dispositionDisplayState(
  state: ServiceRequestState,
  assigneeUserId: string | null,
  scheduledAt: Date | null,
): DispositionDisplayState {
  if (state === "completed") return "abgeschlossen";
  if (state === "rejected") return "abgelehnt";
  if (state === "in_progress") return "in_arbeit";
  if (state === "scheduled" || scheduledAt) return "terminiert";
  if (assigneeUserId && PRE_SCHEDULE.includes(state)) return "zugewiesen";
  return "erfasst";
}

/** Console may advance through scheduling; completion is recorded in Prüfpartner. */
const CONSOLE_ADVANCE_CHAIN: DispositionDisplayState[] = [
  "erfasst",
  "zugewiesen",
  "terminiert",
  "in_arbeit",
];

export function nextDispositionDisplayState(
  current: DispositionDisplayState,
): DispositionDisplayState | null {
  const i = CONSOLE_ADVANCE_CHAIN.indexOf(current);
  if (i < 0 || i >= CONSOLE_ADVANCE_CHAIN.length - 1) return null;
  return CONSOLE_ADVANCE_CHAIN[i + 1] ?? null;
}

function shortExecutorCode(code: string | null | undefined): string | null {
  if (!code) return null;
  return code.replace(/^O-/i, "");
}

function mapRow(
  r: {
    tenantId: string;
    reference: string;
    locationText: string;
    subjectId: string;
    subjectType?: string;
    serviceType: string;
    state: ServiceRequestState;
    executorOrgId: string | null;
    assigneeUserId: string | null;
    scheduledAt: Date | null;
    createdAt: Date;
    executorOrg: { name: string; code?: string; organisationId?: string | null } | null;
    assigneeUser: { name: string } | null;
  },
  tenant: { code: string | null; name: string } | undefined,
  managed: boolean,
  isExecutor: boolean,
  device?: { label: string; detail: string | null } | null,
): ConsoleRequestRowDTO {
  const displayState = dispositionDisplayState(r.state, r.assigneeUserId, r.scheduledAt);
  const deviceLabel = device?.label || r.locationText || r.subjectId;
  return {
    tenantId: r.tenantId,
    tenantCode: tenant?.code ?? null,
    tenantName: tenant?.name ?? r.tenantId,
    reference: r.reference,
    deviceLabel,
    deviceDetail: device?.detail ?? null,
    serviceType: r.serviceType,
    state: r.state,
    executorOrgId: r.executorOrgId,
    executorName: r.executorOrg?.name ?? null,
    executorCode: shortExecutorCode(r.executorOrg?.code) ?? null,
    assigneeUserId: r.assigneeUserId,
    assigneeName: r.assigneeUser?.name ?? null,
    scheduledAt: isoDateTime(r.scheduledAt),
    displayState,
    nextDisplayState: nextDispositionDisplayState(displayState),
    raisedAt: r.createdAt.toISOString(),
    managed,
    isExecutor,
  };
}

async function deviceLabelsForRequests(
  rows: { subjectType: string; subjectId: string; tenantId: string; locationText: string }[],
): Promise<Map<string, { label: string; detail: string | null }>> {
  const instanceIds = [
    ...new Set(rows.filter((r) => r.subjectType === "instance").map((r) => r.subjectId)),
  ];
  if (instanceIds.length === 0) return new Map();
  const devices = await prisma.deviceInstance.findMany({
    where: { id: { in: instanceIds } },
    select: {
      id: true,
      inventoryNumber: true,
      model: { select: { tradeName: true, modelName: true } },
    },
  });
  const out = new Map<string, { label: string; detail: string | null }>();
  for (const d of devices) {
    const trade = d.model?.tradeName?.trim() || null;
    const model = d.model?.modelName?.trim() || null;
    const inv = d.inventoryNumber?.trim() || null;
    const label = trade || model || inv || d.id;
    let detail: string | null = null;
    if (trade && model && model !== trade) detail = model;
    else if ((trade || model) && inv) detail = inv;
    out.set(d.id, { label, detail });
  }
  return out;
}

export const dispositionService = {
  /**
   * Customer portfolio — orders on institutions with a live management contract.
   * Oversight + contractor take-over; scheduling lives on the executor dispatch desk.
   */
  async list(ctx: PartnerContext): Promise<ConsoleRequestListDTO> {
    requirePartnerPermission(ctx, "console:disposition:view");
    return runWithoutTenantAsync(async () => {
      const now = new Date();
      const contracts = await prisma.serviceContract.findMany({
        where: { organisationId: ctx.organisationId },
        include: { tenant: { select: { id: true, name: true, code: true } } },
      });
      const liveTenants = new Map(
        contracts.filter((c) => isLiveContract(c, now)).map((c) => [c.tenantId, c.tenant]),
      );
      const managedIds = [...liveTenants.keys()];
      if (managedIds.length === 0) {
        return { rows: [] };
      }

      const rows = await prisma.serviceRequest.findMany({
        where: {
          tenantId: { in: managedIds },
          transmittedAt: { not: null },
          state: { not: "rejected" },
        },
        include: {
          executorOrg: { select: { name: true, code: true, organisationId: true } },
          assigneeUser: { select: { name: true } },
          tenant: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 300,
      });

      const devices = await deviceLabelsForRequests(rows);

      return {
        rows: rows.map((r) =>
          mapRow(
            r,
            liveTenants.get(r.tenantId) ?? r.tenant,
            true,
            r.executorOrg?.organisationId === ctx.organisationId,
            r.subjectType === "instance" ? devices.get(r.subjectId) : null,
          ),
        ),
      };
    });
  },

  async listInspectionOrders(ctx: PartnerContext): Promise<ConsoleRequestListDTO> {
    requirePartnerPermission(ctx, "console:assignments:view");
    return runWithoutTenantAsync(async () => {
      const now = new Date();
      const contracts = await prisma.serviceContract.findMany({
        where: { organisationId: ctx.organisationId },
        include: { tenant: { select: { id: true, name: true, code: true } } },
      });
      const liveTenants = new Map(
        contracts.filter((c) => isLiveContract(c, now)).map((c) => [c.tenantId, c.tenant]),
      );

      const rows = await prisma.serviceRequest.findMany({
        where: {
          executorOrg: { organisationId: ctx.organisationId },
          transmittedAt: { not: null },
          state: { not: "rejected" },
        },
        include: {
          executorOrg: { select: { name: true, code: true, organisationId: true } },
          assigneeUser: { select: { name: true } },
          tenant: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 300,
      });

      const devices = await deviceLabelsForRequests(rows);

      return {
        rows: rows.map((r) =>
          mapRow(
            r,
            liveTenants.get(r.tenantId) ?? r.tenant,
            liveTenants.has(r.tenantId),
            true,
            r.subjectType === "instance" ? devices.get(r.subjectId) : null,
          ),
        ),
      };
    });
  },

  async listMySites(ctx: PartnerContext): Promise<MySitesListDTO> {
    requirePartnerPermission(ctx, "console:disposition:view");
    const isAdmin = ctx.user.appRole === "admin";
    const depotPostalCode = "53111";
    const depotLabel = "Bonn";

    return runWithoutTenantAsync(async () => {
      const now = new Date();
      const contracts = await prisma.serviceContract.findMany({
        where: { organisationId: ctx.organisationId },
        include: { tenant: { select: { id: true, name: true, code: true } } },
      });
      const liveContracts = contracts.filter((c) => isLiveContract(c, now));
      const liveTenantIds = liveContracts.map((c) => c.tenantId);
      const liveTenantIdSet = new Set(liveTenantIds);

      const [memberships, sites, requests] = await Promise.all([
        prisma.orgMembership.findMany({
          where: {
            organisationId: ctx.organisationId,
            isExternal: false,
            validFrom: { lte: now },
            OR: [{ validTo: null }, { validTo: { gte: now } }],
            user: { active: true, accountKind: "partner" },
          },
          include: {
            user: { select: { id: true, name: true } },
            staffAssignments: { select: { tenantId: true } },
          },
          orderBy: { user: { name: "asc" } },
        }),
        liveTenantIds.length
          ? prisma.site.findMany({
              where: { tenantId: { in: liveTenantIds } },
              select: {
                tenantId: true,
                postalCode: true,
                city: true,
                address: true,
              },
              orderBy: { id: "asc" },
            })
          : Promise.resolve([]),
        liveTenantIds.length
          ? prisma.serviceRequest.findMany({
              where: {
                tenantId: { in: liveTenantIds },
                transmittedAt: { not: null },
                state: { not: "rejected" },
              },
              select: { tenantId: true, scheduledAt: true },
              orderBy: { createdAt: "desc" },
              take: 500,
            })
          : Promise.resolve([]),
      ]);

      const staffAssignments: MySitesListDTO["staffAssignments"] = [];
      for (const m of memberships) {
        const tenantIdsForMember =
          m.appRole === "admin"
            ? liveTenantIds
            : m.staffAssignments
                .map((a) => a.tenantId)
                .filter((id) => liveTenantIdSet.has(id));
        for (const tenantId of tenantIdsForMember) {
          staffAssignments.push({
            tenantId,
            userId: m.user.id,
            name: m.user.name,
          });
        }
      }

      const tenantIdsAssignedToMe = new Set(
        staffAssignments.filter((a) => a.userId === ctx.user.id).map((a) => a.tenantId),
      );
      const tenantIds = isAdmin ? liveTenantIds : [...tenantIdsAssignedToMe];

      const contractByTenant = new Map(liveContracts.map((c) => [c.tenantId, c.id]));
      const tenantById = new Map(liveContracts.map((c) => [c.tenantId, c.tenant]));
      const siteByTenant = new Map<string, (typeof sites)[number]>();
      for (const s of sites) {
        if (!siteByTenant.has(s.tenantId)) siteByTenant.set(s.tenantId, s);
      }

      const tenants: MySitesListDTO["tenants"] = tenantIds
        .map((tenantId) => {
          const tenant = tenantById.get(tenantId);
          const site = siteByTenant.get(tenantId);
          const postalCode = site?.postalCode?.trim() || null;
          const city = site?.city?.trim() || null;
          const location =
            [postalCode, city].filter(Boolean).join(" ") || site?.address?.trim() || null;
          return {
            tenantId,
            tenantCode: tenant?.code ?? null,
            tenantName: tenant?.name ?? tenantId,
            contractId: contractByTenant.get(tenantId) ?? null,
            location,
            postalCode,
            distanceBand: distanceBandFromPostal(depotPostalCode, postalCode),
          };
        })
        .sort((a, b) => a.tenantName.localeCompare(b.tenantName));

      const visibleTenantIds = new Set(tenantIds);
      const inspections: MySitesListDTO["inspections"] = requests
        .filter((r) => visibleTenantIds.has(r.tenantId))
        .map((r) => ({
          tenantId: r.tenantId,
          scheduledAt: isoDateTime(r.scheduledAt),
        }));

      const visibleStaff = staffAssignments.filter((a) => visibleTenantIds.has(a.tenantId));

      return {
        tenants,
        staffAssignments: visibleStaff,
        inspections,
        colleagues: memberships.map((m) => ({
          userId: m.user.id,
          name: m.user.name,
        })),
        depotLabel,
        depotPostalCode,
        totalInspections: inspections.length,
      };
    });
  },

  /** Institution portal opened from My institutions — all assignments, own marked. */
  async getSitePortal(ctx: PartnerContext, tenantId: string): Promise<SitePortalDTO> {
    requirePartnerPermission(ctx, "console:disposition:view");
    return runWithoutTenantAsync(async () => {
      const now = new Date();
      const contract = await prisma.serviceContract.findFirst({
        where: { organisationId: ctx.organisationId, tenantId },
        include: { tenant: { select: { id: true, name: true, code: true } } },
      });
      if (!contract || !isLiveContract(contract, now)) {
        throw notFound("Institution not found.");
      }

      if (ctx.user.appRole !== "admin") {
        const membership = await prisma.orgMembership.findFirst({
          where: {
            organisationId: ctx.organisationId,
            userId: ctx.user.id,
            isExternal: false,
          },
          include: { staffAssignments: { select: { tenantId: true } } },
        });
        const assigned = membership?.staffAssignments.some((a) => a.tenantId === tenantId);
        if (!assigned) throw forbidden();
      }

      const site = await prisma.site.findFirst({
        where: { tenantId },
        select: { postalCode: true, city: true, address: true },
        orderBy: { id: "asc" },
      });
      const location =
        [site?.postalCode?.trim(), site?.city?.trim()].filter(Boolean).join(" ") ||
        site?.address?.trim() ||
        null;

      const rows = await prisma.serviceRequest.findMany({
        where: {
          tenantId,
          transmittedAt: { not: null },
          state: { not: "rejected" },
        },
        include: {
          assigneeUser: { select: { id: true, name: true } },
          executorOrg: { select: { organisationId: true } },
          duty: {
            select: {
              dueAt: true,
              dutyKey: true,
              deadlineAnchor: true,
              referenceDate: true,
              lastCompletedAt: true,
              intervalValue: true,
              intervalUnit: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
        take: 300,
      });

      const instanceIds = [
        ...new Set(rows.filter((r) => r.subjectType === "instance").map((r) => r.subjectId)),
      ];
      const devices =
        instanceIds.length > 0
          ? await prisma.deviceInstance.findMany({
              where: { id: { in: instanceIds }, tenantId },
              select: {
                id: true,
                inventoryNumber: true,
                serialNumber: true,
                room: true,
                model: { select: { tradeName: true, modelName: true } },
                area: { select: { name: true } },
              },
            })
          : [];
      const deviceById = new Map(devices.map((d) => [d.id, d]));

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const assignments: SiteAssignmentRowDTO[] = rows.map((r) => {
        const device = r.subjectType === "instance" ? deviceById.get(r.subjectId) : undefined;
        const deviceLabel =
          device?.model?.tradeName ||
          device?.model?.modelName ||
          r.locationText ||
          r.subjectId;
        const locParts = [device?.area?.name, device?.room].filter(Boolean);
        const locationText =
          locParts.length > 0 ? locParts.join(" · ") : r.locationText || "—";
        const dueAt = isoDate(resolveInventoryDutyDue(r.duty));
        const overdue = Boolean(
          dueAt && new Date(`${dueAt}T00:00:00`) < today && r.state !== "completed",
        );
        return {
          reference: r.reference,
          inventoryNumber: device?.inventoryNumber ?? null,
          serialNumber: device?.serialNumber ?? null,
          deviceLabel,
          serviceType: r.serviceType,
          locationText,
          dueAt,
          overdue,
          displayState: dispositionDisplayState(r.state, r.assigneeUserId, r.scheduledAt),
          assigneeUserId: r.assigneeUserId,
          assigneeName: r.assigneeUser?.name ?? null,
          isMine: r.assigneeUserId === ctx.user.id,
          isExecutor: r.executorOrg?.organisationId === ctx.organisationId,
        };
      });

      assignments.sort((a, b) => {
        if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
        if (a.dueAt) return -1;
        if (b.dueAt) return 1;
        return a.reference.localeCompare(b.reference);
      });

      const assigneesMemberships = await prisma.orgMembership.findMany({
        where: {
          organisationId: ctx.organisationId,
          validFrom: { lte: now },
          OR: [{ validTo: null }, { validTo: { gte: now } }],
          user: { active: true, accountKind: "partner" },
        },
        include: {
          user: { select: { id: true, name: true } },
          staffAssignments: { select: { tenantId: true } },
        },
      });
      const assignees = assigneesMemberships
        .filter((m) => {
          if (m.appRole === "admin" && !m.isExternal) return true;
          if (m.isExternal) {
            return (
              m.commissionedFrom &&
              m.commissionedTo &&
              m.liabilityUntil &&
              m.commissionedFrom <= now &&
              m.commissionedTo >= now &&
              m.liabilityUntil >= now
            );
          }
          return m.staffAssignments.some((a) => a.tenantId === tenantId);
        })
        .map((m) => ({
          userId: m.user.id,
          name: m.user.name,
          isExternal: m.isExternal,
        }));

      const mineCount = assignments.filter((a) => a.isMine).length;

      return {
        tenantId,
        tenantCode: contract.tenant.code,
        tenantName: contract.tenant.name,
        contractId: contract.id,
        location,
        mineCount,
        totalCount: assignments.length,
        assignments,
        assignees,
      };
    });
  },

  /**
   * Portal assign rules:
   * - caller may update their own assignments
   * - admins may assign when the row is still unassigned
   */
  async assignFromPortal(
    ctx: PartnerContext,
    reference: string,
    input: DispositionAssignParsed,
  ): Promise<ConsoleRequestRowDTO> {
    requirePartnerPermission(ctx, "console:disposition:assign");
    await runWithoutTenantAsync(async () => {
      const row = await prisma.serviceRequest.findFirst({
        where: { reference },
        select: { assigneeUserId: true, transmittedAt: true, state: true },
      });
      if (!row) throw notFound("Service request not found.");
      if (!row.transmittedAt) {
        throw unprocessable(
          "Assignment is not visible until the clinic transmits it.",
          { field: "transmittedAt" },
        );
      }
      if (row.state === "rejected") {
        throw unprocessable("Assignment was withdrawn.", { field: "state" });
      }
      const isOwn = row.assigneeUserId === ctx.user.id;
      const isAdminClaim = ctx.user.appRole === "admin" && row.assigneeUserId == null;
      if (!isOwn && !isAdminClaim) {
        throw forbidden();
      }
    });
    return this.assign(ctx, reference, input);
  },

  /** @deprecated use assignFromPortal */
  async assignOwn(
    ctx: PartnerContext,
    reference: string,
    input: DispositionAssignParsed,
  ): Promise<ConsoleRequestRowDTO> {
    return this.assignFromPortal(ctx, reference, input);
  },

  /**
   * Advance one console disposition step (mockup → button).
   * Gates: assignee required before "zugewiesen"; appointment before "terminiert".
   * Optional scheduledAt is persisted only on this click (not on date pick).
   * Stops at in_arbeit — completion is recorded in Prüfpartner.
   */
  async advance(
    ctx: PartnerContext,
    reference: string,
    input: DispositionAdvanceParsed = {},
  ): Promise<ConsoleRequestRowDTO> {
    requirePartnerPermission(ctx, "console:disposition:assign");

    return runWithoutTenantAsync(async () => {
      const row = await prisma.serviceRequest.findFirst({
        where: { reference },
        include: {
          executorOrg: { select: { name: true, code: true, organisationId: true } },
          assigneeUser: { select: { name: true } },
          tenant: { select: { id: true, name: true, code: true } },
        },
      });
      if (!row) throw notFound("Service request not found.");
      if (!row.transmittedAt) {
        throw unprocessable(
          "Assignment is not visible until the clinic transmits it.",
          { field: "transmittedAt" },
        );
      }
      if (row.state === "rejected") {
        throw unprocessable("Assignment was withdrawn.", { field: "state" });
      }

      const now = new Date();
      const contract = await prisma.serviceContract.findFirst({
        where: { organisationId: ctx.organisationId, tenantId: row.tenantId },
      });
      const managed = Boolean(contract && isLiveContract(contract, now));
      const isExecutor = row.executorOrg?.organisationId === ctx.organisationId;
      if (!managed && !isExecutor) throw forbidden();
      // Only the executing contractor may schedule or advance — managing partners may view
      // and reassign the contractor, but not run another org's disposition.
      if (!isExecutor) {
        throw unprocessable(
          "Only the executing organisation can schedule or advance this assignment.",
          { field: "executorOrgId" },
        );
      }

      let nextScheduled = row.scheduledAt;
      if (input.scheduledAt !== undefined) {
        nextScheduled = parseAppointmentInput(input.scheduledAt);
      }

      // Use persisted appointment for step detection so a draft date cannot skip stages.
      const display = dispositionDisplayState(row.state, row.assigneeUserId, row.scheduledAt);
      const next = nextDispositionDisplayState(display);
      if (!next) {
        throw unprocessable(
          "No further stage on this console. Completion is recorded in the inspection partner access.",
          { field: "state" },
        );
      }

      if (next === "zugewiesen" && !row.assigneeUserId) {
        throw unprocessable("Assign a handler before advancing.", { field: "assigneeUserId" });
      }
      if (next === "terminiert" && !nextScheduled) {
        throw unprocessable("Set an appointment before advancing.", { field: "scheduledAt" });
      }

      let nextState: ServiceRequestState = row.state;
      if (next === "zugewiesen") {
        if (row.state === "captured" || row.state === "queued" || row.state === "transmitted") {
          nextState = "acknowledged";
        }
      } else if (next === "terminiert") {
        nextState = "scheduled";
      } else if (next === "in_arbeit") {
        nextState = "in_progress";
      }

      const updated = await prisma.serviceRequest.update({
        where: { id: row.id },
        data: {
          state: nextState,
          scheduledAt: nextScheduled,
        },
        include: {
          executorOrg: { select: { name: true, code: true } },
          assigneeUser: { select: { name: true } },
          tenant: { select: { id: true, name: true, code: true } },
        },
      });

      if (nextState !== row.state) {
        await prisma.statusEvent.create({
          data: {
            tenantId: row.tenantId,
            serviceRequestId: row.id,
            state: nextState,
            source: "console",
            actor: ctx.user.name,
            note: dispositionHistoryNote(next, {
              assigneeName: updated.assigneeUser?.name ?? null,
              scheduledAt: updated.scheduledAt,
            }),
          },
        });
      }

      await recordAudit({
        actor: actorFromPartnerOrg(ctx),
        resource: "service_request",
        resourceId: row.id,
        action: "update",
        summary: `Disposition advanced ${reference} to ${next}`,
        before: {
          state: row.state,
          scheduledAt: isoDateTime(row.scheduledAt),
          displayState: display,
        },
        after: {
          state: updated.state,
          scheduledAt: isoDateTime(updated.scheduledAt),
          displayState: next,
        },
      });

      const devices = await deviceLabelsForRequests([updated]);
      return mapRow(
        updated,
        updated.tenant,
        managed,
        isExecutor,
        updated.subjectType === "instance" ? devices.get(updated.subjectId) : null,
      );
    });
  },

  async assign(
    ctx: PartnerContext,
    reference: string,
    input: DispositionAssignParsed,
  ): Promise<ConsoleRequestRowDTO> {
    requirePartnerPermission(ctx, "console:disposition:assign");

    return runWithoutTenantAsync(async () => {
      const row = await prisma.serviceRequest.findFirst({
        where: { reference },
        include: {
          executorOrg: { select: { name: true, code: true, organisationId: true } },
          assigneeUser: { select: { name: true } },
          tenant: { select: { id: true, name: true, code: true } },
        },
      });
      if (!row) throw notFound("Service request not found.");
      if (!row.transmittedAt) {
        throw unprocessable(
          "Assignment is not visible until the clinic transmits it.",
          { field: "transmittedAt" },
        );
      }
      if (row.state === "rejected") {
        throw unprocessable("Assignment was withdrawn.", { field: "state" });
      }

      const contract = await prisma.serviceContract.findFirst({
        where: { organisationId: ctx.organisationId, tenantId: row.tenantId },
      });
      const managed = Boolean(contract && isLiveContract(contract));
      const isExecutor = row.executorOrg?.organisationId === ctx.organisationId;
      if (!managed && !isExecutor) {
        throw forbidden();
      }

      let nextExecutorId = row.executorOrgId;
      let nextExecutorOrgId: string | null = row.executorOrg?.organisationId ?? null;
      if (input.executorOrgId !== undefined) {
        if (!managed) {
          throw unprocessable("Only the managing organisation can change the contractor.", {
            field: "executorOrgId",
          });
        }
        if (input.executorOrgId === null || input.executorOrgId === "") {
          nextExecutorId = null;
          nextExecutorOrgId = null;
        } else {
          const org = await prisma.executorOrg.findFirst({
            where: {
              id: input.executorOrgId,
              tenantId: row.tenantId,
              active: true,
            },
          });
          if (!org) throw unprocessable("Unknown executor.", { field: "executorOrgId" });
          nextExecutorId = org.id;
          nextExecutorOrgId = org.organisationId;
        }
      }

      const willBeExecutor = nextExecutorOrgId === ctx.organisationId;
      const executorChanged = nextExecutorId !== row.executorOrgId;

      let nextAssignee = row.assigneeUserId;
      if (executorChanged) {
        // Contractor change always clears the previous org's handler.
        nextAssignee = null;
      }
      if (input.assigneeUserId !== undefined) {
        if (!willBeExecutor) {
          throw unprocessable(
            "Only the executing organisation can assign staff for this assignment.",
            { field: "assigneeUserId" },
          );
        }
        if (input.assigneeUserId === null || input.assigneeUserId === "") {
          nextAssignee = null;
        } else {
          const membership = await prisma.orgMembership.findFirst({
            where: {
              organisationId: ctx.organisationId,
              userId: input.assigneeUserId,
              validFrom: { lte: new Date() },
              OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
            },
            include: { staffAssignments: true },
          });
          if (!membership) throw unprocessable("Unknown assignee.", { field: "assigneeUserId" });
          if (membership.isExternal) {
            const now = new Date();
            if (
              !membership.commissionedFrom ||
              !membership.commissionedTo ||
              !membership.liabilityUntil ||
              membership.commissionedFrom > now ||
              membership.commissionedTo < now ||
              membership.liabilityUntil < now
            ) {
              throw unprocessable("External inspector commission or liability is not valid.", {
                field: "assigneeUserId",
              });
            }
          } else if (membership.appRole !== "admin") {
            const assigned = membership.staffAssignments.some((a) => a.tenantId === row.tenantId);
            if (!assigned) {
              throw unprocessable("Assignee is not assigned to this tenant.", {
                field: "assigneeUserId",
              });
            }
          }
          nextAssignee = input.assigneeUserId;
        }
      }

      let nextScheduled = row.scheduledAt;
      let nextState = row.state;
      if (input.scheduledAt !== undefined) {
        if (!willBeExecutor) {
          throw unprocessable(
            "Only the executing organisation can schedule this assignment.",
            { field: "scheduledAt" },
          );
        }
        nextScheduled = parseAppointmentInput(input.scheduledAt);
        if (!nextScheduled) {
          if (row.state === "scheduled") nextState = nextAssignee ? "acknowledged" : "captured";
        } else if (PRE_SCHEDULE.includes(row.state) || row.state === "scheduled") {
          nextState = "scheduled";
        }
      }

      const updated = await prisma.serviceRequest.update({
        where: { id: row.id },
        data: {
          executorOrgId: nextExecutorId,
          allocatedAt: nextExecutorId ? new Date() : null,
          allocatedBy: nextExecutorId ? ctx.user.name : null,
          assigneeUserId: nextAssignee,
          scheduledAt: nextScheduled,
          state: nextState,
        },
        include: {
          executorOrg: { select: { name: true, code: true, organisationId: true } },
          assigneeUser: { select: { name: true } },
          tenant: { select: { id: true, name: true, code: true } },
        },
      });

      if (nextState !== row.state) {
        const displayNext = dispositionDisplayState(
          updated.state,
          updated.assigneeUserId,
          updated.scheduledAt,
        );
        await prisma.statusEvent.create({
          data: {
            tenantId: row.tenantId,
            serviceRequestId: row.id,
            state: nextState,
            source: "console",
            actor: ctx.user.name,
            note: dispositionHistoryNote(displayNext, {
              assigneeName: updated.assigneeUser?.name ?? null,
              scheduledAt: updated.scheduledAt,
            }),
          },
        });
      }

      await recordAudit({
        actor: actorFromPartnerOrg(ctx),
        resource: "service_request",
        resourceId: row.id,
        action: "update",
        summary: `Disposition updated for ${reference}`,
        before: {
          executorOrgId: row.executorOrgId,
          assigneeUserId: row.assigneeUserId,
          scheduledAt: isoDateTime(row.scheduledAt),
          state: row.state,
        },
        after: {
          executorOrgId: updated.executorOrgId,
          assigneeUserId: updated.assigneeUserId,
          scheduledAt: isoDateTime(updated.scheduledAt),
          state: updated.state,
        },
      });

      const devices = await deviceLabelsForRequests([updated]);
      return mapRow(
        updated,
        updated.tenant,
        managed,
        updated.executorOrg?.organisationId === ctx.organisationId,
        updated.subjectType === "instance" ? devices.get(updated.subjectId) : null,
      );
    });
  },

  async assigneesForTenant(ctx: PartnerContext, tenantId: string) {
    requirePartnerPermission(ctx, "console:disposition:view");
    return runWithoutTenantAsync(async () => {
      const now = new Date();
      const memberships = await prisma.orgMembership.findMany({
        where: {
          organisationId: ctx.organisationId,
          validFrom: { lte: now },
          OR: [{ validTo: null }, { validTo: { gte: now } }],
          user: { active: true, accountKind: "partner" },
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          staffAssignments: true,
        },
      });

      return memberships
        .filter((m) => {
          if (m.appRole === "admin" && !m.isExternal) return true;
          if (m.isExternal) {
            return (
              m.commissionedFrom &&
              m.commissionedTo &&
              m.liabilityUntil &&
              m.commissionedFrom <= now &&
              m.commissionedTo >= now &&
              m.liabilityUntil >= now
            );
          }
          return m.staffAssignments.some((a) => a.tenantId === tenantId);
        })
        .map((m) => ({
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
          isExternal: m.isExternal,
          appRole: m.appRole,
        }));
    });
  },

  /**
   * Managing partner reassigns the contractor to their own linked ExecutorOrg
   * for the tenant (take over from another contractor such as RTS).
   */
  async takeOver(ctx: PartnerContext, reference: string): Promise<ConsoleRequestRowDTO> {
    requirePartnerPermission(ctx, "console:disposition:assign");

    const executorOrgId = await runWithoutTenantAsync(async () => {
      const row = await prisma.serviceRequest.findFirst({
        where: { reference },
        select: { tenantId: true, transmittedAt: true, state: true },
      });
      if (!row) throw notFound("Service request not found.");
      if (!row.transmittedAt) {
        throw unprocessable(
          "Assignment is not visible until the clinic transmits it.",
          { field: "transmittedAt" },
        );
      }
      if (row.state === "rejected") {
        throw unprocessable("Assignment was withdrawn.", { field: "state" });
      }

      const contract = await prisma.serviceContract.findFirst({
        where: { organisationId: ctx.organisationId, tenantId: row.tenantId },
      });
      if (!contract || !isLiveContract(contract)) {
        throw unprocessable("Only the managing organisation can take over this assignment.", {
          field: "executorOrgId",
        });
      }

      const mine = await prisma.executorOrg.findFirst({
        where: {
          tenantId: row.tenantId,
          organisationId: ctx.organisationId,
          active: true,
        },
        orderBy: { sortOrder: "asc" },
      });
      if (!mine) {
        throw unprocessable(
          "No executor organisation linked to your partner for this institution.",
          { field: "executorOrgId" },
        );
      }
      return mine.id;
    });

    return this.assign(ctx, reference, { executorOrgId });
  },
};
