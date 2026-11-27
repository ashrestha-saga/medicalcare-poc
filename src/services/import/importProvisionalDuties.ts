/**
 * E103 / R65 — merge import lastPerformances into device duties.
 * Upsert by duty key: never wipe duties the file did not mention;
 * never clear a non-provisional Erstanlage freeze.
 */
import type { DutyKey, Prisma } from "@prisma/client";
import { computeDutyDueAt } from "@/services/registration/dueDate";
import type { ImportLastPerformance, NormalizedRow } from "./types";

const DEFAULT_INTERVAL_MONTHS: Record<string, number> = {
  stk: 24,
  mtk: 24,
  wartung: 12,
  dguv: 24,
  konstanz: 12,
  validierung: 12,
};

const INSPECTION_TYPE: Record<string, string> = {
  stk: "STK",
  mtk: "MTK",
  wartung: "MAINT",
  dguv: "DGUV",
  konstanz: "CONSTANCY",
  validierung: "VALIDATION",
};

const TITLE: Record<string, string> = {
  stk: "STK",
  mtk: "MTK",
  wartung: "Wartung",
  dguv: "DGUV V3",
  konstanz: "Konstanzprüfung",
  validierung: "Validierung",
};

function toDutyKey(raw: string): DutyKey | null {
  const k = raw.trim().toLowerCase();
  if (
    k === "stk" ||
    k === "mtk" ||
    k === "wartung" ||
    k === "dguv" ||
    k === "konstanz" ||
    k === "validierung"
  ) {
    return k as DutyKey;
  }
  return null;
}

/** Build lastPerformances from normalized row (new array + legacy pruefungen). */
export function lastPerformancesFromNormalized(n: NormalizedRow): ImportLastPerformance[] {
  if (n.lastPerformances?.length) return n.lastPerformances;
  const out: ImportLastPerformance[] = [];
  for (const p of n.pruefungen || []) {
    out.push({
      dutyKey: p.art === "MTK" ? "mtk" : "stk",
      performedAt: p.iso,
      result: "passed",
      performedBy: undefined,
      reportRef: p.raw,
      source: "file",
    });
  }
  return out;
}

export type MergeImportPerformancesArgs = {
  tenantId: string;
  deviceInstanceId: string;
  actorLabel: string;
  jobFileName: string;
  sheet: string;
  rowNo: number;
  performances: ImportLastPerformance[];
  maintenanceCycleMonths?: number | null;
  /**
   * When true (released with a real freeze), missing duty keys are NOT created —
   * they are returned in pendingNewKeys for import_review.
   */
  requireReviewForNewKeys?: boolean;
};

export type MergeImportPerformancesResult = {
  /** Existing duties whose lastCompletedAt / dueAt were advanced. */
  updated: number;
  /** New provisional duties created (draft / no real freeze only). */
  createdProvisional: number;
  /** File date older or equal to current lastCompletedAt. */
  skippedOlder: number;
  /** Duty keys present in the file but absent on a real freeze. */
  pendingNewKeys: DutyKey[];
};

/**
 * Merge file last-performances into open duties by dutyKey.
 * - Updates dates on existing open duties (provisional or frozen).
 * - Creates provisional duties only when there is no real freeze (or requireReviewForNewKeys is false).
 * - Never deletes duties the file did not mention.
 */
export async function mergeImportPerformances(
  tx: Prisma.TransactionClient,
  args: MergeImportPerformancesArgs,
): Promise<MergeImportPerformancesResult> {
  const performances = args.performances.filter((p) => toDutyKey(p.dutyKey) && p.performedAt);
  const result: MergeImportPerformancesResult = {
    updated: 0,
    createdProvisional: 0,
    skippedOlder: 0,
    pendingNewKeys: [],
  };
  if (!performances.length) return result;

  const hasRealFreeze = !(await lacksRealReleaseFreeze(tx, args.deviceInstanceId));
  const blockNewKeys = Boolean(args.requireReviewForNewKeys) && hasRealFreeze;

  let provisionalSnapshot =
    !hasRealFreeze
      ? await tx.deviceReleaseSnapshot.findFirst({
          where: {
            deviceInstanceId: args.deviceInstanceId,
            provisional: true,
            appVersion: "import",
          },
          orderBy: { releasedAt: "desc" },
        })
      : null;

  const seenKeys = new Set<string>();

  for (const perf of performances) {
    const dutyKey = toDutyKey(perf.dutyKey)!;
    const dedupeKey = `${dutyKey}:${perf.performedAt}`;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    const ref = new Date(`${perf.performedAt}T00:00:00.000Z`);
    if (Number.isNaN(ref.getTime())) continue;

    // Prefer a real (non-provisional) open duty; else provisional.
    const duties = await tx.deviceDuty.findMany({
      where: {
        deviceInstanceId: args.deviceInstanceId,
        dutyKey,
        suspendedAt: null,
      },
      orderBy: [{ provisional: "asc" }, { referenceDate: "desc" }],
    });
    let duty = duties.find((d) => !d.provisional) ?? duties[0] ?? null;

    if (duty) {
      if (duty.lastCompletedAt && duty.lastCompletedAt.getTime() >= ref.getTime()) {
        result.skippedOlder++;
        continue;
      }

      const dueAt = computeDutyDueAt({
        deadlineAnchor: duty.deadlineAnchor,
        referenceDate: duty.referenceDate,
        lastCompletedAt: ref,
        intervalValue: duty.intervalValue,
        intervalUnit: duty.intervalUnit,
      });

      await tx.deviceDuty.update({
        where: { id: duty.id },
        data: {
          lastCompletedAt: ref,
          dueAt,
        },
      });

      const existingPerf = await tx.dutyPerformance.findFirst({
        where: {
          deviceDutyId: duty.id,
          performedAt: ref,
          source: "import",
        },
        select: { id: true },
      });
      if (!existingPerf) {
        const perfResult =
          perf.result === "failed" ? "failed" : "passed";
        await tx.dutyPerformance.create({
          data: {
            tenantId: args.tenantId,
            deviceDutyId: duty.id,
            performedAt: ref,
            result: perfResult,
            note: perf.reportRef || `Import ${args.jobFileName} Z.${args.rowNo}`,
            performedBy: perf.performedBy?.trim() || args.actorLabel || "Import",
            source: "import",
          },
        });
      }
      result.updated++;
      continue;
    }

    // No open duty for this key.
    if (blockNewKeys) {
      if (!result.pendingNewKeys.includes(dutyKey)) {
        result.pendingNewKeys.push(dutyKey);
      }
      continue;
    }

    if (!provisionalSnapshot) {
      provisionalSnapshot = await tx.deviceReleaseSnapshot.create({
        data: {
          tenantId: args.tenantId,
          deviceInstanceId: args.deviceInstanceId,
          releasedBy: args.actorLabel,
          ruleSetIds: "[]",
          characteristics: "{}",
          derivedDuties: JSON.stringify([{ id: dutyKey, from: "import" }]),
          prerequisites: "[]",
          appVersion: "import",
          provisional: true,
        },
      });
    }

    const months =
      perf.intervalMonths ??
      (dutyKey === "wartung"
        ? (args.maintenanceCycleMonths ?? DEFAULT_INTERVAL_MONTHS.wartung)
        : null) ??
      DEFAULT_INTERVAL_MONTHS[dutyKey] ??
      24;
    const dueAt = computeDutyDueAt({
      deadlineAnchor: "month_end",
      referenceDate: ref,
      lastCompletedAt: ref,
      intervalValue: months,
      intervalUnit: "months",
    });

    duty = await tx.deviceDuty.create({
      data: {
        tenantId: args.tenantId,
        deviceInstanceId: args.deviceInstanceId,
        snapshotId: provisionalSnapshot.id,
        dutyKey,
        inspectionTypeCode: INSPECTION_TYPE[dutyKey] ?? "STK",
        deadlineAnchor: "month_end",
        intervalValue: months,
        intervalUnit: "months",
        basisText: `Import ${args.jobFileName} Zeile ${args.rowNo} — vorläufig (Erstanlage ausstehend)`,
        confidence: "derived",
        applicable: true,
        referenceDate: ref,
        dueAt,
        lastCompletedAt: ref,
        title: TITLE[dutyKey] ?? dutyKey.toUpperCase(),
        category: dutyKey === "wartung" ? "operating" : "inspection",
        provisional: true,
      },
    });

    await tx.dutyPerformance.create({
      data: {
        tenantId: args.tenantId,
        deviceDutyId: duty.id,
        performedAt: ref,
        result: perf.result === "failed" ? "failed" : "passed",
        note: perf.reportRef || null,
        performedBy: perf.performedBy?.trim() || "Import",
        source: "import",
      },
    });
    result.createdProvisional++;
  }

  return result;
}

/** @deprecated Prefer mergeImportPerformances — kept for call-site compatibility. */
export async function writeImportProvisionalDuties(
  tx: Prisma.TransactionClient,
  args: Omit<MergeImportPerformancesArgs, "requireReviewForNewKeys">,
): Promise<number> {
  const r = await mergeImportPerformances(tx, { ...args, requireReviewForNewKeys: false });
  return r.updated + r.createdProvisional;
}

type SnapshotLookup = {
  deviceReleaseSnapshot: {
    findFirst(args: {
      where: { deviceInstanceId: string; provisional: boolean };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
};

/**
 * E103 — unit marked released (e.g. inventory state flip) without a real
 * non-provisional DeviceReleaseSnapshot. Erstanlage may still run as a repair freeze.
 */
export async function lacksRealReleaseFreeze(
  db: SnapshotLookup,
  deviceInstanceId: string,
): Promise<boolean> {
  const real = await db.deviceReleaseSnapshot.findFirst({
    where: { deviceInstanceId, provisional: false },
    select: { id: true },
  });
  return !real;
}

/**
 * R66 — on real Erstanlage release: suspend provisional duties and re-link
 * imported performances onto the new duty of the same dutyKey.
 */
export async function suspendProvisionalAndRelinkPerformances(
  tx: Prisma.TransactionClient,
  args: {
    deviceInstanceId: string;
    /** Newly created non-provisional duties in this release (by dutyKey). */
    newDutiesByKey: Map<DutyKey, string>;
    now?: Date;
  },
): Promise<void> {
  const now = args.now ?? new Date();
  const provisional = await tx.deviceDuty.findMany({
    where: {
      deviceInstanceId: args.deviceInstanceId,
      provisional: true,
    },
    select: { id: true, dutyKey: true, lastCompletedAt: true, suspendedAt: true },
  });
  if (!provisional.length) return;

  for (const old of provisional) {
    const newDutyId = args.newDutiesByKey.get(old.dutyKey);
    if (newDutyId) {
      await tx.dutyPerformance.updateMany({
        where: { deviceDutyId: old.id, source: "import" },
        data: { deviceDutyId: newDutyId },
      });
      if (old.lastCompletedAt) {
        const target = await tx.deviceDuty.findFirst({
          where: { id: newDutyId },
          select: { lastCompletedAt: true },
        });
        if (!target?.lastCompletedAt || target.lastCompletedAt < old.lastCompletedAt) {
          await tx.deviceDuty.update({
            where: { id: newDutyId },
            data: { lastCompletedAt: old.lastCompletedAt },
          });
        }
      }
    }
    if (!old.suspendedAt) {
      await tx.deviceDuty.update({
        where: { id: old.id },
        data: { suspendedAt: now },
      });
    }
  }
}
