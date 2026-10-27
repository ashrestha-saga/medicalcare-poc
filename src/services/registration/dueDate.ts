/**
 * Due-date arithmetic per deadline anchor (NFA-704 / FA-452).
 * Pure — calculates, decides nothing.
 */
import { addMonthsUtc, addWorkingDaysUtc, onOrAfterWorkingDayUtc } from "@/lib/maintenance/schedule";
import { toIntervalUnit } from "./dutyKeys";

export type DeadlineAnchor =
  | "month_end"
  | "year_end"
  | "exact_day"
  | "event"
  | "interval"
  | "process"
  | "permanent"
  | "reference"
  | "none";

export function intervalUnitFromEinheits(
  einheit: string | null | undefined,
): "months" | "years" | "working_days" | null {
  return toIntervalUnit(einheit);
}

export function dueDate(
  anchor: DeadlineAnchor | string,
  baseDate: Date,
  intervalValue: number | null | undefined,
  intervalUnit: string | null | undefined,
): Date | null {
  if (anchor === "none" || anchor === "reference") return null;
  if (intervalValue == null || !intervalUnit) return null;
  if (anchor === "event" || anchor === "process" || anchor === "permanent" || anchor === "interval") {
    return null;
  }

  const base = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate()));

  if (intervalUnit === "working_days") {
    if (anchor !== "exact_day" && anchor !== "month_end") return null;
    // 0 = due on/after base working day (initial takt); n>0 = n working days after base.
    if (intervalValue <= 0) return onOrAfterWorkingDayUtc(base);
    return addWorkingDaysUtc(base, intervalValue);
  }

  const months = intervalUnit === "years" ? intervalValue * 12 : intervalUnit === "months" ? intervalValue : null;
  if (months == null) return null;

  if (anchor === "exact_day") {
    return addMonthsUtc(base, months);
  }

  if (anchor === "month_end") {
    const shifted = addMonthsUtc(base, months);
    return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0));
  }

  if (anchor === "year_end") {
    const years = intervalUnit === "months" ? Math.floor(intervalValue / 12) : intervalValue;
    return new Date(Date.UTC(base.getUTCFullYear() + years, 11, 31));
  }

  return null;
}

/** Next due from last completion when present, otherwise the original reference date. */
export function computeDutyDueAt(input: {
  deadlineAnchor: string;
  referenceDate: Date;
  lastCompletedAt?: Date | null;
  intervalValue: number | null | undefined;
  intervalUnit: string | null | undefined;
}): Date | null {
  const base = input.lastCompletedAt ?? input.referenceDate;
  // After a completion, always advance by the full interval (even for working_days).
  const intervalValue =
    input.lastCompletedAt && input.intervalUnit === "working_days" && (input.intervalValue ?? 0) <= 0
      ? 1
      : input.intervalValue;
  return dueDate(input.deadlineAnchor, base, intervalValue, input.intervalUnit);
}
