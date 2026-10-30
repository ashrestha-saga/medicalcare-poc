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

function isUtcWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

/** Next Mon–Fri on or after `date` (UTC calendar day). */
export function onOrAfterWorkingDayUtc(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  while (isUtcWeekend(d)) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}

/**
 * Add `n` Mon–Fri days in UTC.
 * `n <= 0` → on-or-after working day of `date` (no advance).
 */
export function addWorkingDaysUtc(date: Date, n: number): Date {
  if (n <= 0) return onOrAfterWorkingDayUtc(date);
  let d = onOrAfterWorkingDayUtc(date);
  // Start counting from the next day after a working-day base when advancing.
  d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
  let left = n;
  while (left > 0) {
    if (!isUtcWeekend(d)) left -= 1;
    if (left === 0) break;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
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

/**
 * Header, list, and label read the frozen Wartung duty when it has a date.
 * The instance column can lag behind that duty.
 */
export function overlayMaintenanceDue<
  T extends { nextMaintenanceDueAt: string | null; maintenanceStatus: MaintenanceStatus },
>(dto: T, dueAt: Date | null | undefined): T {
  if (!dueAt || Number.isNaN(dueAt.getTime())) return dto;
  return {
    ...dto,
    nextMaintenanceDueAt: dueAt.toISOString(),
    maintenanceStatus: deriveMaintenanceStatus(dueAt),
  };
}

export function earliestDue(dates: Array<Date | null | undefined>): Date | null {
  let best: Date | null = null;
  for (const d of dates) {
    if (!d || Number.isNaN(d.getTime())) continue;
    if (!best || d.getTime() < best.getTime()) best = d;
  }
  return best;
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
