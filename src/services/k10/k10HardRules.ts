/** Pure hard-rule helpers for K1–K10 (unit-tested without Prisma). */

export type TileUrgency = "overdue" | "due" | "info" | "ok" | "empty";

const URGENCY_RANK: Record<TileUrgency, number> = {
  overdue: 0,
  due: 1,
  info: 2,
  ok: 3,
  empty: 4,
};

/** Unreleased / rejected batches must not be treated as usable. */
export function isBatchUsable(releaseResult: string | null | undefined): boolean {
  return releaseResult === "released" || releaseResult === "released_with_conditions";
}

/** Disclosure sessions expire hard; closed sessions are inactive. */
export function isDisclosureActive(
  session: { closedAt: Date | null; expiresAt: Date },
  nowMs: number = Date.now(),
): boolean {
  return !session.closedAt && session.expiresAt.getTime() > nowMs;
}

/**
 * Zone-1 (`decides`): sort by urgency, keep top `max`, never hide remainder —
 * overflow moves to worklist. Empty tiles sort last but stay reachable.
 */
export function trimDecidesZone<T extends { urgency: TileUrgency; sortOrder: number }>(
  tiles: T[],
  max = 3,
): { decides: T[]; overflow: T[] } {
  const sorted = [...tiles].sort(
    (a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || a.sortOrder - b.sortOrder,
  );
  return { decides: sorted.slice(0, max), overflow: sorted.slice(max) };
}

/**
 * C1: Konstanz dueAt comes only from an open ConstancyCadence.
 * DeviceDuty for konstanz stays applicable; dueAt is never invented from
 * RefConstancyObject.defaultCadence. No open cadence ⇒ null (“Takt festzulegen”).
 */
export function konstanzDueAtFromCadence(
  openCadence: { intervalValue: number; intervalUnit: "months" | "years"; determinedAt: Date } | null,
  computeDueAt: (args: {
    deadlineAnchor: string;
    referenceDate: Date;
    intervalValue: number | null | undefined;
    intervalUnit: string | null | undefined;
  }) => Date | null,
): Date | null {
  if (!openCadence) return null;
  return computeDueAt({
    deadlineAnchor: "month_end",
    referenceDate: openCadence.determinedAt,
    intervalValue: openCadence.intervalValue,
    intervalUnit: openCadence.intervalUnit,
  });
}
