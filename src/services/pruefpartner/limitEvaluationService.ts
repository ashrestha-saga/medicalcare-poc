/** Parse German decimal strings ("0,30") to number. */
export function parseGermanNumber(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export type LimitOp = "le" | "ge" | "pm";

export interface ParsedLimit {
  op: LimitOp;
  value: number;
  /** For ± limits, the tolerance band. */
  tolerance?: number;
}

/** Parse limit text like "≤ 0,30", "≥ 2,0", "± 5". */
export function parseLimitText(limitText: string | null | undefined): ParsedLimit | null {
  if (!limitText?.trim()) return null;
  const t = limitText.trim();
  const pm = t.match(/^±\s*([\d,.]+)/);
  if (pm) {
    const tolerance = parseGermanNumber(pm[1]!);
    if (tolerance == null) return null;
    return { op: "pm", value: 0, tolerance };
  }
  const le = t.match(/^[≤<]\s*([\d,.]+)/);
  if (le) {
    const value = parseGermanNumber(le[1]!);
    return value != null ? { op: "le", value } : null;
  }
  const ge = t.match(/^[≥>]\s*([\d,.]+)/);
  if (ge) {
    const value = parseGermanNumber(ge[1]!);
    return value != null ? { op: "ge", value } : null;
  }
  return null;
}

export function evaluateAgainstLimit(measured: number, limit: ParsedLimit): boolean {
  if (limit.op === "le") return measured <= limit.value;
  if (limit.op === "ge") return measured >= limit.value;
  if (limit.op === "pm" && limit.tolerance != null) {
    return Math.abs(measured) <= limit.tolerance;
  }
  return false;
}

/** DIN EN 62353 — doubling within limit is a baseline finding. */
export function baselineDeviationFlag(
  measured: number,
  baseline: number,
  withinAbsoluteLimit: boolean,
): boolean {
  if (!withinAbsoluteLimit || baseline <= 0) return false;
  const ratio = measured / baseline;
  return ratio >= 2 || ratio <= 0.5;
}

export function evaluateMeasurement(args: {
  measuredValue: string;
  limitText: string | null | undefined;
  baselineValue?: string | null;
  comparedToBaseline?: boolean;
}): { withinLimit: boolean | null; baselineFlag: boolean } {
  const measured = parseGermanNumber(args.measuredValue);
  if (measured == null) return { withinLimit: null, baselineFlag: false };

  const limit = parseLimitText(args.limitText);
  let withinLimit: boolean | null = limit ? evaluateAgainstLimit(measured, limit) : null;

  let baselineFlag = false;
  if (args.comparedToBaseline && args.baselineValue) {
    const baseline = parseGermanNumber(args.baselineValue);
    if (baseline != null) {
      if (withinLimit == null) {
        withinLimit = true;
      }
      baselineFlag = baselineDeviationFlag(measured, baseline, withinLimit);
    }
  }

  return { withinLimit, baselineFlag };
}
