/**
 * Due-date arithmetic per deadline anchor (NFA-704 / FA-452).
 * Pure — calculates, decides nothing.
 */
import { addMonthsUtc } from "@/lib/maintenance/schedule";

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

export function intervalUnitFromEinheits(einheit: string | null | undefined): "months" | "years" | null {
  if (einheit === "Monate" || einheit === "months") return "months";
  if (einheit === "Jahre" || einheit === "years") return "years";
  return null;
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
  return dueDate(input.deadlineAnchor, base, input.intervalValue, input.intervalUnit);
}
