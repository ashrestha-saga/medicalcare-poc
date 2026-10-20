import type {
  AuthorityFindingDTO,
  AuthorityInspectionDTO,
  ChecklistPrepDTO,
  DisclosureSessionDTO,
  TenantContext,
} from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { actorFromTenant } from "@/lib/auth/actorContext";
import { recordedByAttribution } from "@/lib/auth/attribution";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import { isDisclosureActive } from "@/services/k10/k10HardRules";
import { authorityNotificationService } from "@/services/authority/authorityNotificationService";
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
    requirePermission(ctx, "authority:view");
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
    requirePermission(ctx, "authority:view");
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
    requirePermission(ctx, "authority:view");
    const existing = await prisma.authorityFinding.findFirst({ where: { id: findingId } });
    if (!existing) throw notFound("Finding not found");
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
    requirePermission(ctx, "authority:view");
    const expiresAt = new Date(input.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      throw badRequest("expiresAt must be in the future");
    }
    const row = await prisma.disclosureSession.create({
      data: {
        tenantId: ctx.tenantId,
        openedByUserId: ctx.user.id,
        expiresAt,
        audience: input.audience,
        purpose: input.purpose ?? null,
        scope: JSON.stringify(input.scope),
      },
    });
    const actor = actorFromTenant(ctx);
    await recordAudit({
      actor: { ...actor, correlationId: row.id },
      resource: "DisclosureSession",
      resourceId: row.id,
      action: "open",
      summary: `Disclosure for ${input.audience}`,
    });
    return {
      id: row.id,
      openedAt: row.openedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      closedAt: null,
      audience: row.audience,
      purpose: row.purpose,
      scope: input.scope,
      active: true,
    };
  },

  async closeDisclosure(ctx: TenantContext, id: string): Promise<DisclosureSessionDTO> {
    requirePermission(ctx, "authority:view");
    const existing = await prisma.disclosureSession.findFirst({ where: { id } });
    if (!existing) throw notFound("Disclosure session not found");
    const row = await prisma.disclosureSession.update({
      where: { id },
      data: { closedAt: new Date() },
    });
    await recordAudit({
      actor: { ...actorFromTenant(ctx), correlationId: row.id },
      resource: "DisclosureSession",
      resourceId: id,
      action: "close",
      summary: "Disclosure session closed",
    });
    return {
      id: row.id,
      openedAt: row.openedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      closedAt: row.closedAt?.toISOString() ?? null,
      audience: row.audience,
      purpose: row.purpose,
      scope: parseScope(row.scope),
      active: false,
    };
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
    });
    return rows.map((r) => ({
      id: r.id,
      openedAt: r.openedAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      closedAt: r.closedAt?.toISOString() ?? null,
      audience: r.audience,
      purpose: r.purpose,
      scope: parseScope(r.scope),
      active: isDisclosureActive(r),
    }));
  },
};
