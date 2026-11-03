import type { CataloguePreviewDTO } from "@/interfaces/pruefpartner";

export type DayBucket = "heute" | "ohne" | "morgen" | "woche" | "spaeter";

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

/** Prefer appointment date for day plan; fall back to duty due. */
export function planDate(row: Pick<CataloguePreviewDTO, "scheduledAt" | "dueAt">): string | null {
  return row.scheduledAt ?? row.dueAt ?? null;
}

/** Bucket by appointment/due date relative to today (UTC date). */
export function tagesBucket(dueAt: string | null | undefined, today = new Date()): DayBucket {
  if (!dueAt) return "ohne";
  const due = startOfDay(new Date(`${dueAt.slice(0, 10)}T00:00:00.000Z`));
  const t0 = startOfDay(today);
  const t1 = addDays(t0, 1);
  const t7 = addDays(t0, 7);
  if (due.getTime() <= t0.getTime()) return "heute"; // overdue + today
  if (due.getTime() === t1.getTime()) return "morgen";
  if (due.getTime() <= t7.getTime()) return "woche";
  return "spaeter";
}

export function filterByBuckets(
  rows: CataloguePreviewDTO[],
  buckets: DayBucket[],
): CataloguePreviewDTO[] {
  const set = new Set(buckets);
  return rows.filter((r) => set.has(tagesBucket(planDate(r))));
}
