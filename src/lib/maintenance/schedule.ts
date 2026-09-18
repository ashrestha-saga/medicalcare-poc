/** Maintenance schedule helpers — cycle on model/instance, due date on instance. */

export type MaintenanceStatus = "ok" | "due" | "overdue" | "unset";

/** Add calendar months in UTC (stable across environments). */
export function addMonthsUtc(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  // Clamp end-of-month overflow (e.g. Jan 31 + 1 month).
  if (d.getUTCDate() < day) {
    d.setUTCDate(0);
  }
  return d;
}

/**
 * nextDue = (lastMaintainedAt ?? maintenanceAnchorAt) + cycleMonths.
 * Returns null when cycle or base date is missing / invalid.
 */
export function computeNextMaintenanceDueAt(input: {
  cycleMonths: number | null | undefined;
  anchorAt: Date | null | undefined;
  lastMaintainedAt?: Date | null | undefined;
}): Date | null {
  const months = input.cycleMonths;
  if (months == null || !Number.isFinite(months) || months <= 0) return null;
  const base = input.lastMaintainedAt ?? input.anchorAt;
  if (!base || Number.isNaN(base.getTime())) return null;
  return addMonthsUtc(base, Math.floor(months));
}

function startOfUtcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Derive status from next due date (calendar-day UTC). */
export function deriveMaintenanceStatus(
  nextDueAt: Date | null | undefined,
  now: Date = new Date(),
): MaintenanceStatus {
  if (!nextDueAt || Number.isNaN(nextDueAt.getTime())) return "unset";
  const due = startOfUtcDay(nextDueAt);
  const today = startOfUtcDay(now);
  if (due < today) return "overdue";
  if (due === today) return "due";
  return "ok";
}

/** Resolve inventarize/create cycle: explicit input → model default → null. */
export function resolveMaintenanceCycleMonths(
  inputCycle: number | null | undefined,
  modelCycle: number | null | undefined,
): number | null {
  if (inputCycle != null && Number.isFinite(inputCycle) && inputCycle > 0) {
    return Math.floor(inputCycle);
  }
  if (modelCycle != null && Number.isFinite(modelCycle) && modelCycle > 0) {
    return Math.floor(modelCycle);
  }
  return null;
}
