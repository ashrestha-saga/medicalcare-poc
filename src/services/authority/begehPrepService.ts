import type { BegehGapDTO, ChecklistPrepDTO, TenantContext } from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { prisma } from "@/lib/prisma";
import { reprocessingEvidenceService } from "@/services/reprocessingEvidence/reprocessingEvidenceService";
import { constancyCadenceService } from "@/services/constancy/constancyCadenceService";

export type { BegehGapDTO };

export interface BegehPrepDTO {
  gaps: BegehGapDTO[];
  openFindings: number;
  overdueFindings: number;
  remediatedUnproven: number;
}

/** Live “what a Behörde would miss” — points to views, not forms. */
export async function listBegehGaps(ctx: TenantContext): Promise<BegehGapDTO[]> {
  requirePermission(ctx, "authority:view");
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
    openClarifications,
    missingDutyOverlap,
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
    prisma.deviceClarification.count({ where: { resolvedAt: null } }),
    countMissingDutyOverlapDecisions(),
  ]);

  const gaps: BegehGapDTO[] = [];
  const add = (count: number, label: string, href: string) => {
    if (count > 0) gaps.push({ count, label, href });
  };
  add(openDaily, "Daily routine checks without evidence for today", "/reprocessing?openToday=1");
  add(unreleasedBatches, "Batches without a release decision", "/reprocessing?section=batches");
  add(unassessed, "Incidents without seriousness assessment", "/incidents?view=unassessed");
  add(unreported, "Reportable incidents not yet reported", "/incidents?view=unreported");
  add(
    unmatchedFs,
    "Recall Abgleich open (to check or measure not recorded)",
    "/field-safety?view=unmatched",
  );
  add(missingCadence, "Constancy objects without a determined takt", "/constancy-cadence?section=missing");
  add(draftDevices, "Devices in inventory still in draft", "/devices?state=draft");
  add(openClarifications, "Open clarifications still unresolved", "/clarifications");
  add(
    missingDutyOverlap,
    "Overlap questions without an operator decision",
    "/duty-overlap",
  );

  return gaps.sort((a, b) => b.count - a.count);
}

/**
 * R6 — devices that have a duty whose inspection type appears in
 * RefInspectionTypeOverlap but lack an open DutyOverlapDecision for that pair.
 */
async function countMissingDutyOverlapDecisions(): Promise<number> {
  const overlaps = await prisma.refInspectionTypeOverlap.findMany({
    select: { inspectionTypeCode: true, satisfiedByCode: true },
  });
  if (overlaps.length === 0) return 0;

  const typeCodes = [...new Set(overlaps.flatMap((o) => [o.inspectionTypeCode, o.satisfiedByCode]))];
  const devicesWithBoth = await prisma.deviceDuty.findMany({
    where: {
      applicable: true,
      suspendedAt: null,
      inspectionTypeCode: { in: typeCodes },
    },
    select: { deviceInstanceId: true, inspectionTypeCode: true, dutyKey: true },
  });

  const byDevice = new Map<string, Set<string>>();
  for (const d of devicesWithBoth) {
    if (!d.inspectionTypeCode) continue;
    const set = byDevice.get(d.deviceInstanceId) ?? new Set();
    set.add(d.inspectionTypeCode);
    byDevice.set(d.deviceInstanceId, set);
  }

  const candidateIds: string[] = [];
  for (const [deviceId, types] of byDevice) {
    const needs = overlaps.some(
      (o) => types.has(o.inspectionTypeCode) && types.has(o.satisfiedByCode),
    );
    if (needs) candidateIds.push(deviceId);
  }
  if (candidateIds.length === 0) return 0;

  const decided = await prisma.dutyOverlapDecision.findMany({
    where: { deviceInstanceId: { in: candidateIds }, validTo: null },
    select: { deviceInstanceId: true },
  });
  const decidedSet = new Set(decided.map((d) => d.deviceInstanceId));
  return candidateIds.filter((id) => !decidedSet.has(id)).length;
}

/**
 * Live mappe coverage: seed `covered` is a baseline; override with live signals
 * when mapsToSection is known and data exists (or is clearly empty).
 */
export async function liveChecklistCoverage(ctx: TenantContext): Promise<ChecklistPrepDTO[]> {
  requirePermission(ctx, "authority:view");

  const [
    releasedDevices,
    bookEntries,
    trainingEvents,
    dutyPerformances,
    reprocessingChecks,
    evidence,
  ] = await Promise.all([
    prisma.deviceInstance.count({ where: { state: "released" } }),
    prisma.deviceBookEntry.count(),
    prisma.trainingEvent.count(),
    prisma.dutyPerformance.count(),
    prisma.reprocessingCheck.count(),
    prisma.deviceEvidence.count(),
  ]);

  const liveBySection: Record<string, boolean> = {
    deckblatt: true,
    bestandsverzeichnis: releasedDevices > 0,
    medizinproduktebuch: bookEntries > 0 || releasedDevices > 0,
    einweisungen: trainingEvents > 0,
    pruefungen: dutyPerformances > 0,
    aufbereitung: reprocessingChecks > 0,
    nachweise: evidence > 0,
    "offene-punkte": true,
  };

  const lists = await prisma.refAuthorityChecklist.findMany({
    include: { items: { orderBy: { position: "asc" } } },
    orderBy: { code: "asc" },
  });

  return lists.map((l) => {
    const items = l.items.map((i) => {
      const section = i.mapsToSection;
      const hasLive = section != null && section in liveBySection;
      const covered = hasLive ? liveBySection[section!]! : i.covered;
      return {
        position: i.position,
        label: i.label,
        legalBasis: i.legalBasis,
        mapsToSection: i.mapsToSection,
        covered,
        live: hasLive,
      };
    });
    return {
      code: l.code,
      label: l.label,
      authorityKind: l.authorityKind,
      sourceRef: l.sourceRef,
      items,
      coveredCount: items.filter((i) => i.covered).length,
      totalCount: items.length,
    };
  });
}

export async function getBegehPrep(ctx: TenantContext): Promise<BegehPrepDTO> {
  requirePermission(ctx, "authority:view");
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [gaps, openFindings, overdueFindings, remediatedUnproven] = await Promise.all([
    listBegehGaps(ctx),
    prisma.authorityFinding.count({ where: { status: "open" } }),
    prisma.authorityFinding.count({
      where: { status: "open", dueAt: { lt: today } },
    }),
    prisma.authorityFinding.count({ where: { status: "remediated" } }),
  ]);

  return { gaps, openFindings, overdueFindings, remediatedUnproven };
}
