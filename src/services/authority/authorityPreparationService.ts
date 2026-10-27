import type { TenantContext } from "@/interfaces";
import {
  PREPARATION_GAPS,
  UNMAPPED_PREPARATION_GAPS,
  type PreparationGapCode,
  type PreparationGapDef,
} from "@/constants/authorityPreparationGaps";
import { isDossierSectionKey } from "@/constants/authorityDossier";
import { requirePermission } from "@/lib/auth/tenantContext";
import { actorFromTenant } from "@/lib/auth/actorContext";
import { recordedByAttribution } from "@/lib/auth/attribution";
import { badRequest, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import { reprocessingEvidenceService } from "@/services/reprocessingEvidence/reprocessingEvidenceService";
import { constancyCadenceService } from "@/services/constancy/constancyCadenceService";

export type PrepItemState = "ready" | "gap" | "external";

export type PreparationItemDTO = {
  itemId: string;
  position: number;
  label: string;
  legalBasis: string | null;
  mapsToSection: string | null;
  covered: boolean;
  state: PrepItemState;
  gapCount: number;
  gapTarget: string | null;
  readiness: {
    externalReady: boolean;
    documentRef: string | null;
    checkedBy: string | null;
    checkedAt: string | null;
  } | null;
};

export type UnmappedGapDTO = {
  code: PreparationGapCode;
  count: number;
  target: string;
  label: string;
};

export type PreparationListDTO = {
  checklistCode: string;
  checklistLabel: string;
  items: PreparationItemDTO[];
  unmapped: UnmappedGapDTO[];
  progress: { ready: number; gap: number; external: number; total: number };
};

export type AuthorityOverviewDTO = {
  items: number;
  ready: number;
  gap: number;
  external: number;
  findingsOpen: number;
  findingsRemediated: number;
  otherLists: { checklistCode: string; authorityName: string; open: number }[];
};

const GAP_LABELS: Record<PreparationGapCode, string> = {
  draft_devices: "Devices still in draft",
  open_daily_checks: "Daily routine checks without evidence for today",
  unreleased_batches: "Batches without a release decision",
  unassessed_incidents: "Incidents without seriousness assessment",
  unreported_incidents: "Reportable incidents not yet reported",
  missing_constancy_cadence: "Constancy objects without a determined takt",
  field_safety_unmatched: "Recall Abgleich open",
};

async function gapCounts(ctx: TenantContext): Promise<Record<PreparationGapCode, number>> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const [
    openDaily,
    unreleasedBatches,
    unassessed,
    unreported,
    unmatchedFs,
    missingCadence,
    draftDevices,
  ] = await Promise.all([
    reprocessingEvidenceService.countOpenDailyChecks(ctx),
    prisma.reprocessingBatch.count({ where: { releaseResult: null } }),
    prisma.deviceIncident.count({
      where: { suspectedSerious: null, assessedAt: null, closedAt: null },
    }),
    prisma.deviceIncident.count({
      where: { suspectedSerious: true, reportedAt: null, closedAt: null },
    }),
    prisma.fieldSafetyDeviceAction.count({
      where: {
        fieldSafetyAction: { closedAt: null },
        OR: [{ affected: null }, { affected: true, actionTakenAt: null }],
      },
    }),
    constancyCadenceService.listMissing(ctx).then((r) => r.length),
    prisma.deviceInstance.count({ where: { state: "draft" } }),
  ]);
  return {
    open_daily_checks: openDaily,
    unreleased_batches: unreleasedBatches,
    unassessed_incidents: unassessed,
    unreported_incidents: unreported,
    field_safety_unmatched: unmatchedFs,
    missing_constancy_cadence: missingCadence,
    draft_devices: draftDevices,
  };
}

function sectionGapTotal(
  section: string | null | undefined,
  counts: Record<PreparationGapCode, number>,
): { count: number; target: string | null } {
  if (!section || !PREPARATION_GAPS[section]) return { count: 0, target: null };
  const defs = PREPARATION_GAPS[section]!;
  let count = 0;
  let target: string | null = null;
  for (const d of defs) {
    const n = counts[d.code] ?? 0;
    if (n > 0) {
      count += n;
      if (!target) target = d.target;
    }
  }
  return { count, target };
}

/** R6 — derived readiness state for one checklist. */
export const authorityPreparationService = {
  async overview(
    ctx: TenantContext,
    listCode: string,
    siteId?: string | null,
  ): Promise<AuthorityOverviewDTO> {
    requirePermission(ctx, "authority:view");
    const prep = await this.preparation(ctx, listCode);
    const checklist = await prisma.refAuthorityChecklist.findUnique({
      where: { code: listCode },
      select: { code: true, authorityKind: true, label: true },
    });
    if (!checklist) throw notFound("Checklist not found");

    /** Match explicit checklistCode, or legacy rows with null code but same authorityKind. */
    const matchesList = {
      OR: [
        { checklistCode: listCode },
        { checklistCode: null, authorityKind: checklist.authorityKind },
      ],
      ...(siteId ? { siteId } : {}),
    };

    const [findingsOpen, findingsRemediated, otherFindings] = await Promise.all([
      prisma.authorityFinding.count({
        where: { status: "open", inspection: matchesList },
      }),
      prisma.authorityFinding.count({
        where: { status: "remediated", inspection: matchesList },
      }),
      prisma.authorityFinding.findMany({
        where: {
          status: { in: ["open", "remediated"] },
          NOT: { inspection: matchesList },
        },
        select: {
          status: true,
          inspection: {
            select: { checklistCode: true, authorityName: true, authorityKind: true },
          },
        },
      }),
    ]);

    const byList = new Map<string, { checklistCode: string; authorityName: string; open: number }>();
    for (const row of otherFindings) {
      const code = row.inspection.checklistCode ?? `kind:${row.inspection.authorityKind}`;
      const cur = byList.get(code) ?? {
        checklistCode: row.inspection.checklistCode ?? code,
        authorityName: row.inspection.authorityName,
        open: 0,
      };
      if (row.status === "open") cur.open += 1;
      byList.set(code, cur);
    }

    return {
      items: prep.progress.total,
      ready: prep.progress.ready,
      gap: prep.progress.gap,
      external: prep.progress.external,
      findingsOpen,
      findingsRemediated,
      otherLists: [...byList.values()].filter((x) => x.open > 0),
    };
  },

  async preparation(ctx: TenantContext, listCode: string): Promise<PreparationListDTO> {
    requirePermission(ctx, "authority:view");
    const checklist = await prisma.refAuthorityChecklist.findUnique({
      where: { code: listCode },
      include: { items: { orderBy: { position: "asc" } } },
    });
    if (!checklist) throw notFound("Checklist not found");

    const [counts, readinessRows] = await Promise.all([
      gapCounts(ctx),
      prisma.checklistItemReadiness.findMany({
        where: {
          tenantId: ctx.tenantId,
          itemId: { in: checklist.items.map((i) => i.id) },
        },
      }),
    ]);
    const readinessByItem = new Map(readinessRows.map((r) => [r.itemId, r]));

    const items: PreparationItemDTO[] = checklist.items.map((i) => {
      const readiness = readinessByItem.get(i.id) ?? null;
      if (!i.covered) {
        const externalReady = Boolean(readiness?.externalReady);
        return {
          itemId: i.id,
          position: i.position,
          label: i.label,
          legalBasis: i.legalBasis,
          mapsToSection: i.mapsToSection,
          covered: false,
          state: externalReady ? ("ready" as const) : ("external" as const),
          gapCount: 0,
          gapTarget: null,
          readiness: readiness
            ? {
                externalReady: readiness.externalReady,
                documentRef: readiness.documentRef,
                checkedBy: readiness.checkedBy,
                checkedAt: readiness.checkedAt.toISOString(),
              }
            : { externalReady: false, documentRef: null, checkedBy: null, checkedAt: null },
        };
      }
      const { count, target } = sectionGapTotal(i.mapsToSection, counts);
      return {
        itemId: i.id,
        position: i.position,
        label: i.label,
        legalBasis: i.legalBasis,
        mapsToSection: i.mapsToSection,
        covered: true,
        state: count > 0 ? ("gap" as const) : ("ready" as const),
        gapCount: count,
        gapTarget: target,
        readiness: null,
      };
    });

    const unmapped: UnmappedGapDTO[] = [];
    for (const def of UNMAPPED_PREPARATION_GAPS) {
      const n = counts[def.code] ?? 0;
      if (n > 0) {
        unmapped.push({
          code: def.code,
          count: n,
          target: def.target,
          label: GAP_LABELS[def.code],
        });
      }
    }

    // Progress: ready = ready state (incl. external ticked); external = unticked only; gap = gap
    let ready = 0;
    let gap = 0;
    let external = 0;
    for (const it of items) {
      if (it.state === "ready") ready += 1;
      else if (it.state === "gap") gap += 1;
      else external += 1;
    }

    return {
      checklistCode: checklist.code,
      checklistLabel: checklist.label,
      items,
      unmapped,
      progress: { ready, gap, external, total: items.length },
    };
  },

  async setReadiness(
    ctx: TenantContext,
    itemId: string,
    input: { externalReady: boolean; documentRef?: string | null },
  ) {
    requirePermission(ctx, "authority:manage");
    const item = await prisma.refAuthorityChecklistItem.findUnique({ where: { id: itemId } });
    if (!item) throw notFound("Checklist item not found");
    if (item.covered) throw badRequest("Readiness tick only applies to uncovered items");
    if (item.mapsToSection && !isDossierSectionKey(item.mapsToSection)) {
      throw badRequest("Item mapsToSection is outside the dossier catalogue");
    }

    const attr = recordedByAttribution(ctx);
    const row = await prisma.checklistItemReadiness.upsert({
      where: { tenantId_itemId: { tenantId: ctx.tenantId, itemId } },
      create: {
        tenantId: ctx.tenantId,
        itemId,
        externalReady: input.externalReady,
        documentRef: input.documentRef?.trim() || null,
        checkedBy: attr.recordedBy,
        checkedByUserId: attr.recordedByUserId,
      },
      update: {
        externalReady: input.externalReady,
        documentRef: input.documentRef?.trim() || null,
        checkedBy: attr.recordedBy,
        checkedByUserId: attr.recordedByUserId,
        checkedAt: new Date(),
      },
    });
    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "ChecklistItemReadiness",
      resourceId: row.id,
      action: "readiness.set",
      summary: input.externalReady ? "Marked bereitgelegt" : "Cleared bereitgelegt",
    });
    return row;
  },
};

/** Snapshot of mapped gap defs for session close summaries. */
export function listGapDefsForSections(sectionKeys: string[]): PreparationGapDef[] {
  const out: PreparationGapDef[] = [];
  for (const key of sectionKeys) {
    for (const d of PREPARATION_GAPS[key] ?? []) out.push(d);
  }
  return out;
}
