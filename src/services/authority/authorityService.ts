import type {
  AuthorityFindingDTO,
  AuthorityInspectionDTO,
  ChecklistPrepDTO,
  DisclosedEventDTO,
  DisclosureCloseSummaryDTO,
  DisclosureGapSnapshotDTO,
  DisclosureSessionDTO,
  TenantContext,
} from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { actorFromTenant } from "@/lib/auth/actorContext";
import { recordedByAttribution } from "@/lib/auth/attribution";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import type { DisputeFindingInput, ProveFindingInput } from "@/schemas/k10";
import { runWithDisclosureWriteBypass } from "@/lib/auth/disclosureWriteBypass";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import { isDisclosureActive } from "@/services/k10/k10HardRules";
import { authorityNotificationService } from "@/services/authority/authorityNotificationService";
import { authorityPreparationService } from "@/services/authority/authorityPreparationService";
import type {
  CreateAuthorityFindingInput,
  CreateAuthorityInspectionInput,
  OpenDisclosureInput,
  RemediateFindingInput,
} from "@/schemas/k10";

function isoDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function parseScope(scope: string): string[] {
  try {
    const parsed = JSON.parse(scope) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function mapFinding(r: {
  id: string;
  inspectionId: string;
  itemNo: string | null;
  description: string;
  legalBasis: string | null;
  dueAt: Date | null;
  status: string;
  deviceInstanceId: string | null;
  remediationNote: string | null;
  remediatedAt: Date | null;
  provenAt: Date | null;
  disputedAt?: Date | null;
  disputedReason?: string | null;
}): AuthorityFindingDTO {
  return {
    id: r.id,
    inspectionId: r.inspectionId,
    itemNo: r.itemNo,
    description: r.description,
    legalBasis: r.legalBasis,
    dueAt: isoDate(r.dueAt),
    status: r.status,
    deviceInstanceId: r.deviceInstanceId,
    remediationNote: r.remediationNote,
    remediatedAt: isoDate(r.remediatedAt),
    provenAt: isoDate(r.provenAt),
    disputedAt: isoDate(r.disputedAt ?? null),
    disputedReason: r.disputedReason ?? null,
  };
}

function mapSession(
  r: {
    id: string;
    openedAt: Date;
    expiresAt: Date;
    closedAt: Date | null;
    audience: string;
    purpose: string | null;
    scope: string;
    siteId?: string | null;
    checklistCode?: string | null;
    participants?: string | null;
    autoClosed?: boolean;
    site?: { name: string } | null;
  },
  extras?: {
    scope?: string[];
    disclosedCount?: number;
    gapsAtOpening?: number | null;
  },
): DisclosureSessionDTO {
  return {
    id: r.id,
    openedAt: r.openedAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
    closedAt: r.closedAt?.toISOString() ?? null,
    audience: r.audience,
    purpose: r.purpose,
    scope: extras?.scope ?? parseScope(r.scope),
    active: isDisclosureActive(r),
    siteId: r.siteId ?? null,
    siteName: r.site?.name ?? null,
    checklistCode: r.checklistCode ?? null,
    participants: r.participants ?? null,
    autoClosed: Boolean(r.autoClosed),
    disclosedCount: extras?.disclosedCount,
    gapsAtOpening: extras?.gapsAtOpening ?? null,
  };
}

function mapDisclosed(r: {
  id: string;
  occurredAt: Date;
  resource: string;
  resourceId: string;
  summary: string;
}): DisclosedEventDTO {
  return {
    id: r.id,
    occurredAt: r.occurredAt.toISOString(),
    resource: r.resource,
    resourceId: r.resourceId,
    label: r.summary,
  };
}

async function gapsSnapshot(
  ctx: TenantContext,
  checklistCode: string | null | undefined,
): Promise<DisclosureGapSnapshotDTO[]> {
  if (!checklistCode) return [];
  try {
    const prep = await authorityPreparationService.preparation(ctx, checklistCode);
    const fromItems = prep.items
      .filter((i) => i.state === "gap" && i.gapCount > 0)
      .map((i) => ({
        code: `item:${i.itemId}`,
        label: i.label,
        count: i.gapCount,
      }));
    const fromUnmapped = prep.unmapped.map((u) => ({
      code: u.code,
      label: u.label,
      count: u.count,
    }));
    return [...fromItems, ...fromUnmapped];
  } catch {
    return [];
  }
}

export const authorityService = {
  async listInspections(ctx: TenantContext): Promise<AuthorityInspectionDTO[]> {
    requirePermission(ctx, "authority:view");
    const rows = await prisma.authorityInspection.findMany({
      include: {
        site: { select: { name: true } },
        _count: { select: { findings: true } },
        findings: { where: { status: { in: ["open", "remediated"] } }, select: { id: true } },
      },
      orderBy: { visitedAt: "desc" },
      take: 200,
    });
    return rows.map((r) => ({
      id: r.id,
      siteId: r.siteId,
      siteName: r.site?.name ?? null,
      authorityKind: r.authorityKind,
      authorityName: r.authorityName,
      legalBasis: r.legalBasis,
      announcedAt: isoDate(r.announcedAt),
      visitedAt: isoDate(r.visitedAt)!,
      protocolReceivedAt: isoDate(r.protocolReceivedAt),
      feeEur: r.feeEur,
      checklistCode: r.checklistCode,
      closedAt: isoDate(r.closedAt),
      findingCount: r._count.findings,
      openFindingCount: r.findings.length,
    }));
  },

  async createInspection(
    ctx: TenantContext,
    input: CreateAuthorityInspectionInput,
  ): Promise<AuthorityInspectionDTO> {
    requirePermission(ctx, "authority:manage");
    if (input.disclosureSessionId) {
      const linked = await prisma.authorityInspection.findFirst({
        where: { disclosureSessionId: input.disclosureSessionId },
        select: { id: true },
      });
      if (linked) throw conflict("Session already has an inspection");
    }
    const row = await prisma.authorityInspection.create({
      data: {
        tenantId: ctx.tenantId,
        siteId: input.siteId ?? null,
        authorityKind: input.authorityKind,
        authorityName: input.authorityName,
        legalBasis: input.legalBasis ?? null,
        announcedAt: input.announcedAt ? new Date(`${input.announcedAt}T00:00:00.000Z`) : null,
        visitedAt: new Date(`${input.visitedAt}T00:00:00.000Z`),
        protocolReceivedAt: input.protocolReceivedAt
          ? new Date(`${input.protocolReceivedAt}T00:00:00.000Z`)
          : null,
        protocolRef: input.protocolRef ?? null,
        feeEur: input.feeEur ?? null,
        checklistCode: input.checklistCode ?? null,
        disclosureSessionId: input.disclosureSessionId ?? null,
        note: input.note ?? null,
        ...recordedByAttribution(ctx),
      },
      include: {
        site: { select: { name: true } },
        _count: { select: { findings: true } },
      },
    });
    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "AuthorityInspection",
      resourceId: row.id,
      action: "create",
      summary: `Inspection by ${row.authorityName}`,
    });
    return {
      id: row.id,
      siteId: row.siteId,
      siteName: row.site?.name ?? null,
      authorityKind: row.authorityKind,
      authorityName: row.authorityName,
      legalBasis: row.legalBasis,
      announcedAt: isoDate(row.announcedAt),
      visitedAt: isoDate(row.visitedAt)!,
      protocolReceivedAt: isoDate(row.protocolReceivedAt),
      feeEur: row.feeEur,
      checklistCode: row.checklistCode,
      closedAt: isoDate(row.closedAt),
      findingCount: row._count.findings,
      openFindingCount: 0,
    };
  },

  async listFindings(
    ctx: TenantContext,
    query: {
      inspectionId?: string;
      findingId?: string;
      status?: string;
      /** When true, only findings with an official due date. */
      hasDue?: boolean;
    } = {},
  ): Promise<AuthorityFindingDTO[]> {
    requirePermission(ctx, "authority:view");
    const rows = await prisma.authorityFinding.findMany({
      where: {
        ...(query.findingId ? { id: query.findingId } : {}),
        ...(query.inspectionId ? { inspectionId: query.inspectionId } : {}),
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.hasDue ? { dueAt: { not: null } } : {}),
      },
      orderBy: [{ dueAt: "asc" }, { recordedAt: "desc" }],
      take: 300,
    });
    return rows.map((r) => ({
      id: r.id,
      inspectionId: r.inspectionId,
      itemNo: r.itemNo,
      description: r.description,
      legalBasis: r.legalBasis,
      dueAt: isoDate(r.dueAt),
      status: r.status,
      deviceInstanceId: r.deviceInstanceId,
      remediationNote: r.remediationNote,
      remediatedAt: isoDate(r.remediatedAt),
      provenAt: isoDate(r.provenAt),
    }));
  },

  async addFinding(
    ctx: TenantContext,
    inspectionId: string,
    input: CreateAuthorityFindingInput,
  ): Promise<AuthorityFindingDTO> {
    requirePermission(ctx, "authority:manage");
    const inspection = await prisma.authorityInspection.findFirst({ where: { id: inspectionId } });
    if (!inspection) throw notFound("Inspection not found");
    const row = await prisma.authorityFinding.create({
      data: {
        tenantId: ctx.tenantId,
        inspectionId,
        itemNo: input.itemNo ?? null,
        description: input.description,
        legalBasis: input.legalBasis ?? null,
        dueAt: input.dueAt ? new Date(`${input.dueAt}T00:00:00.000Z`) : null,
        deviceInstanceId: input.deviceInstanceId ?? null,
        ...recordedByAttribution(ctx),
      },
    });
    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "AuthorityFinding",
      resourceId: row.id,
      action: "create",
      summary: "Finding recorded",
    });
    return {
      id: row.id,
      inspectionId: row.inspectionId,
      itemNo: row.itemNo,
      description: row.description,
      legalBasis: row.legalBasis,
      dueAt: isoDate(row.dueAt),
      status: row.status,
      deviceInstanceId: row.deviceInstanceId,
      remediationNote: row.remediationNote,
      remediatedAt: isoDate(row.remediatedAt),
      provenAt: isoDate(row.provenAt),
    };
  },

  async remediate(
    ctx: TenantContext,
    findingId: string,
    input: RemediateFindingInput & {
      /** When set, also records an AuthorityNotification (finding_remediation). */
      notifyRecipient?: string | null;
    },
  ): Promise<AuthorityFindingDTO> {
    requirePermission(ctx, "authority:manage");
    const existing = await prisma.authorityFinding.findFirst({ where: { id: findingId } });
    if (!existing) throw notFound("Finding not found");
    if (existing.status !== "open" && existing.status !== "disputed") {
      throw conflict("Only open or disputed findings can be remediated");
    }
    const row = await prisma.authorityFinding.update({
      where: { id: findingId },
      data: {
        status: "remediated",
        remediationNote: input.remediationNote,
        remediatedAt: new Date(`${input.remediatedAt}T00:00:00.000Z`),
        evidenceBlobId: input.evidenceBlobId ?? null,
      },
    });

    if (input.notifyRecipient?.trim()) {
      await authorityNotificationService.recordFindingRemediation(ctx, {
        findingId,
        recipientName: input.notifyRecipient.trim(),
        subject: `Abhilfenachweis ${existing.itemNo ? `#${existing.itemNo}` : findingId}`,
        bodyText: input.remediationNote,
        sentAt: input.remediatedAt,
      });
    }

    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "AuthorityFinding",
      resourceId: findingId,
      action: "remediate",
      summary: "Finding remediated",
    });
    return {
      id: row.id,
      inspectionId: row.inspectionId,
      itemNo: row.itemNo,
      description: row.description,
      legalBasis: row.legalBasis,
      dueAt: isoDate(row.dueAt),
      status: row.status,
      deviceInstanceId: row.deviceInstanceId,
      remediationNote: row.remediationNote,
      remediatedAt: isoDate(row.remediatedAt),
      provenAt: isoDate(row.provenAt),
    };
  },

  async checklistPrep(ctx: TenantContext, code?: string): Promise<ChecklistPrepDTO[]> {
    requirePermission(ctx, "authority:view");
    const lists = await prisma.refAuthorityChecklist.findMany({
      where: code ? { code } : undefined,
      include: { items: { orderBy: { position: "asc" } } },
      orderBy: { code: "asc" },
    });
    return lists.map((l) => ({
      code: l.code,
      label: l.label,
      authorityKind: l.authorityKind,
      items: l.items.map((i) => ({
        position: i.position,
        label: i.label,
        legalBasis: i.legalBasis,
        mapsToSection: i.mapsToSection,
        covered: i.covered,
      })),
      coveredCount: l.items.filter((i) => i.covered).length,
      totalCount: l.items.length,
    }));
  },

  async openDisclosure(ctx: TenantContext, input: OpenDisclosureInput): Promise<DisclosureSessionDTO> {
    requirePermission(ctx, "authority:manage");
    const open = await prisma.disclosureSession.findFirst({
      where: { closedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (open) throw conflict("A disclosure session is already open");

    let expiresAt: Date;
    if (input.expiresAt) {
      expiresAt = new Date(input.expiresAt);
    } else {
      const mins = input.durationMinutes ?? 240;
      expiresAt = new Date(Date.now() + mins * 60_000);
    }
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      throw badRequest("expiresAt must be in the future");
    }
    const gaps = await gapsSnapshot(ctx, input.checklistCode);
    const gapsAtOpening = gaps.reduce((n, g) => n + g.count, 0);
    const row = await prisma.disclosureSession.create({
      data: {
        tenantId: ctx.tenantId,
        openedByUserId: ctx.user.id,
        expiresAt,
        audience: input.audience,
        purpose: input.purpose ?? null,
        scope: JSON.stringify(input.scope),
        siteId: input.siteId ?? null,
        checklistCode: input.checklistCode ?? null,
        participants: input.participants ?? null,
      },
      include: { site: { select: { name: true } } },
    });
    const actor = actorFromTenant(ctx);
    await recordAudit({
      actor: { ...actor, correlationId: row.id },
      resource: "DisclosureSession",
      resourceId: row.id,
      action: "session.opened",
      summary: `Disclosure for ${input.audience}`,
      after: {
        scope: input.scope,
        expiresAt: expiresAt.toISOString(),
        gapsAtOpening,
        gaps,
      },
    });
    return mapSession(row, {
      scope: input.scope,
      disclosedCount: 0,
      gapsAtOpening,
    });
  },

  async closeDisclosure(ctx: TenantContext, id: string): Promise<DisclosureCloseSummaryDTO> {
    requirePermission(ctx, "authority:manage");
    const existing = await prisma.disclosureSession.findFirst({
      where: { id },
      include: { site: { select: { name: true } } },
    });
    if (!existing) throw notFound("Disclosure session not found");
    if (existing.closedAt) throw conflict("Session already closed");

    const disclosedRows = await prisma.auditEvent.findMany({
      where: { correlationId: id, action: "disclosed" },
      orderBy: { occurredAt: "asc" },
      take: 500,
    });
    const disclosed = disclosedRows.map(mapDisclosed);
    const gaps = await gapsSnapshot(ctx, existing.checklistCode);
    const openedAudit = await prisma.auditEvent.findFirst({
      where: { resourceId: id, action: "session.opened" },
      orderBy: { occurredAt: "desc" },
      select: { after: true },
    });
    let gapsAtOpening: number | null = null;
    if (openedAudit?.after) {
      try {
        const parsed = JSON.parse(openedAudit.after) as { gapsAtOpening?: number };
        if (typeof parsed.gapsAtOpening === "number") gapsAtOpening = parsed.gapsAtOpening;
      } catch {
        /* ignore */
      }
    }

    const closedAt = new Date();
    const row = await runWithDisclosureWriteBypass(() =>
      prisma.disclosureSession.update({
        where: { id },
        data: { closedAt },
        include: { site: { select: { name: true } } },
      }),
    );
    const durationMinutes = Math.max(
      1,
      Math.round((closedAt.getTime() - existing.openedAt.getTime()) / 60_000),
    );
    await recordAudit({
      actor: { ...actorFromTenant(ctx), correlationId: row.id },
      resource: "DisclosureSession",
      resourceId: id,
      action: "session.closed",
      summary: "Disclosure session closed",
      after: { disclosedCount: disclosed.length, gaps, durationMinutes },
    });
    return {
      session: mapSession(row, {
        disclosedCount: disclosed.length,
        gapsAtOpening,
      }),
      disclosed,
      gaps,
      durationMinutes,
      disclosedCount: disclosed.length,
    };
  },

  async listDisclosed(ctx: TenantContext, sessionId: string): Promise<DisclosedEventDTO[]> {
    requirePermission(ctx, "authority:view");
    const session = await prisma.disclosureSession.findFirst({ where: { id: sessionId } });
    if (!session) throw notFound("Disclosure session not found");
    const rows = await prisma.auditEvent.findMany({
      where: { correlationId: sessionId, action: "disclosed" },
      orderBy: { occurredAt: "asc" },
      take: 500,
    });
    return rows.map(mapDisclosed);
  },

  async recordDisclosed(
    ctx: TenantContext,
    sessionId: string,
    input: { resource: string; resourceId?: string | null; label: string },
  ) {
    requirePermission(ctx, "authority:view");
    const session = await prisma.disclosureSession.findFirst({ where: { id: sessionId } });
    if (!session) throw notFound("Disclosure session not found");
    if (!isDisclosureActive(session)) throw forbidden("Disclosure session expired or closed");

    const since = new Date(Date.now() - 5_000);
    const dup = await prisma.auditEvent.findFirst({
      where: {
        correlationId: sessionId,
        action: "disclosed",
        resource: input.resource,
        resourceId: input.resourceId ?? "",
        occurredAt: { gte: since },
      },
      select: { id: true },
    });
    if (dup) return { id: dup.id, duplicate: true };

    await recordAudit({
      actor: { ...actorFromTenant(ctx), correlationId: sessionId },
      resource: input.resource,
      resourceId: input.resourceId ?? "",
      action: "disclosed",
      summary: input.label,
    });
    return { duplicate: false };
  },

  async prove(
    ctx: TenantContext,
    findingId: string,
    input: ProveFindingInput,
  ): Promise<AuthorityFindingDTO> {
    requirePermission(ctx, "authority:manage");
    const existing = await prisma.authorityFinding.findFirst({ where: { id: findingId } });
    if (!existing) throw notFound("Finding not found");
    if (existing.status !== "remediated") throw conflict("Only remediated findings can be proven");
    const provenAt = new Date(`${input.provenAt}T00:00:00.000Z`);
    if (existing.remediatedAt && provenAt < existing.remediatedAt) {
      throw badRequest("provenAt must be on or after remediatedAt");
    }
    const row = await prisma.authorityFinding.update({
      where: { id: findingId },
      data: { status: "proven", provenAt },
    });
    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "AuthorityFinding",
      resourceId: findingId,
      action: "finding.prove",
      summary: "Finding proven",
    });
    return mapFinding(row);
  },

  async dispute(
    ctx: TenantContext,
    findingId: string,
    input: DisputeFindingInput,
  ): Promise<AuthorityFindingDTO> {
    requirePermission(ctx, "authority:manage");
    const existing = await prisma.authorityFinding.findFirst({ where: { id: findingId } });
    if (!existing) throw notFound("Finding not found");
    if (existing.status !== "open") throw conflict("Only open findings can be disputed");
    const row = await prisma.authorityFinding.update({
      where: { id: findingId },
      data: {
        status: "disputed",
        disputedAt: new Date(),
        disputedReason: input.disputedReason.trim(),
      },
    });
    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "AuthorityFinding",
      resourceId: findingId,
      action: "finding.dispute",
      summary: "Finding disputed",
    });
    return mapFinding(row);
  },

  async assertDisclosureActive(sessionId: string): Promise<void> {
    const session = await prisma.disclosureSession.findFirst({ where: { id: sessionId } });
    if (!session) throw notFound("Disclosure session not found");
    if (!isDisclosureActive(session)) {
      throw forbidden("Disclosure session expired or closed");
    }
  },

  async listDisclosures(ctx: TenantContext): Promise<DisclosureSessionDTO[]> {
    requirePermission(ctx, "authority:view");
    const rows = await prisma.disclosureSession.findMany({
      orderBy: { openedAt: "desc" },
      take: 50,
      include: { site: { select: { name: true } } },
    });
    const ids = rows.map((r) => r.id);
    const [counts, openedAudits] = await Promise.all([
      prisma.auditEvent.groupBy({
        by: ["correlationId"],
        where: { correlationId: { in: ids }, action: "disclosed" },
        _count: { _all: true },
      }),
      prisma.auditEvent.findMany({
        where: { resourceId: { in: ids }, action: "session.opened" },
        select: { resourceId: true, after: true },
      }),
    ]);
    const countById = new Map(
      counts.map((c) => [c.correlationId ?? "", c._count._all] as const),
    );
    const gapsById = new Map<string, number | null>();
    for (const a of openedAudits) {
      if (!a.after) continue;
      try {
        const parsed = JSON.parse(a.after) as { gapsAtOpening?: number };
        if (typeof parsed.gapsAtOpening === "number") {
          gapsById.set(a.resourceId, parsed.gapsAtOpening);
        }
      } catch {
        /* ignore */
      }
    }
    return rows.map((r) =>
      mapSession(r, {
        disclosedCount: countById.get(r.id) ?? 0,
        gapsAtOpening: gapsById.get(r.id) ?? null,
      }),
    );
  },
};
