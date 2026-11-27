/**
 * E90 — Prüfplakette helpers: auto next-due from duty interval + tenant label sequence.
 */
import { prisma } from "@/lib/prisma";
import { computeDutyDueAt } from "@/services/registration/dueDate";

const LABEL_RE = /^([A-Z]{2})-(\d{4})-(\d{4})$/;
export const DEFAULT_LABEL_PREFIX = "DG";

export function formatLabelNumber(prefix: string, year: number, seq: number): string {
  const p = (prefix || DEFAULT_LABEL_PREFIX).toUpperCase().slice(0, 2).padEnd(2, "X");
  return `${p}-${year}-${String(seq).padStart(4, "0")}`;
}

export function parseLabelNumber(value: string | null | undefined): {
  prefix: string;
  year: number;
  seq: number;
} | null {
  const m = LABEL_RE.exec(value?.trim() ?? "");
  if (!m) return null;
  return { prefix: m[1]!, year: Number(m[2]), seq: Number(m[3]) };
}

/** YYYY-MM for the month input / sticker. */
export function toLabelMonth(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Next plakette due month from duty interval after this performance.
 * Falls back to +12 months when the duty has no rollable interval.
 */
export function suggestLabelNextDue(input: {
  performedAt?: Date | null;
  deadlineAnchor?: string | null;
  referenceDate?: Date | null;
  intervalValue?: number | null;
  intervalUnit?: string | null;
}): string {
  const performedAt = input.performedAt ?? new Date();
  const computed =
    input.deadlineAnchor && input.referenceDate
      ? computeDutyDueAt({
          deadlineAnchor: input.deadlineAnchor,
          referenceDate: input.referenceDate,
          lastCompletedAt: performedAt,
          intervalValue: input.intervalValue,
          intervalUnit: input.intervalUnit,
        })
      : null;
  if (computed) return toLabelMonth(computed);
  const fallback = new Date(
    Date.UTC(performedAt.getUTCFullYear() + 1, performedAt.getUTCMonth(), 1),
  );
  return toLabelMonth(fallback);
}

/** Next free DG-YYYY-NNNN (or prefix) for the tenant in the given year. */
export async function allocateLabelNumber(args: {
  tenantId: string;
  prefix?: string;
  year?: number;
}): Promise<string> {
  const year = args.year ?? new Date().getUTCFullYear();
  const prefix = (args.prefix ?? DEFAULT_LABEL_PREFIX).toUpperCase().slice(0, 2);
  const like = `${prefix}-${year}-%`;
  const rows = await prisma.dutyPerformance.findMany({
    where: {
      tenantId: args.tenantId,
      labelNumber: { startsWith: `${prefix}-${year}-` },
    },
    select: { labelNumber: true },
    take: 500,
    orderBy: { recordedAt: "desc" },
  });
  let max = 0;
  for (const row of rows) {
    const parsed = parseLabelNumber(row.labelNumber);
    if (parsed && parsed.prefix === prefix && parsed.year === year) {
      max = Math.max(max, parsed.seq);
    }
  }
  void like;
  return formatLabelNumber(prefix, year, max + 1);
}

export async function resolveInspectionLabel(args: {
  tenantId: string;
  requiresLabel: boolean;
  result: string;
  labelNumber?: string | null;
  labelNextDue?: string | null;
  duty?: {
    deadlineAnchor: string;
    referenceDate: Date;
    intervalValue: number | null;
    intervalUnit: string | null;
  } | null;
  performedAt?: Date | null;
}): Promise<{ labelNumber: string | null; labelNextDue: string | null }> {
  if (!args.requiresLabel || args.result === "failed") {
    return { labelNumber: null, labelNextDue: null };
  }
  let labelNumber = args.labelNumber?.trim() || null;
  if (!labelNumber || !LABEL_RE.test(labelNumber)) {
    labelNumber = await allocateLabelNumber({ tenantId: args.tenantId });
  }
  let labelNextDue = args.labelNextDue?.trim() || null;
  if (!labelNextDue) {
    labelNextDue = suggestLabelNextDue({
      performedAt: args.performedAt,
      deadlineAnchor: args.duty?.deadlineAnchor,
      referenceDate: args.duty?.referenceDate,
      intervalValue: args.duty?.intervalValue,
      intervalUnit: args.duty?.intervalUnit,
    });
  }
  return { labelNumber, labelNextDue };
}
