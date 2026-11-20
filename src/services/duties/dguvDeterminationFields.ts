import { overlapNotApplicableReason } from "@/services/duties/overlapProjection";

export type DguvDeterminationState = "own_check" | "covered_by_stk" | "not_applicable";

export type DguvDeterminationDutyPatch = {
  applicable: boolean;
  suspendedAt: Date | null;
  notApplicableReason: string | null;
  dueAt: Date | null;
  intervalValue: number | null;
  intervalUnit: "months" | null;
};

/**
 * Maps Festlegung state onto DeviceDuty suspension / due fields.
 * covered_by_stk suspends DGUV (STK covers); own_check clears coverage suspension.
 */
export function computeDguvDeterminationDutyPatch(input: {
  state: DguvDeterminationState;
  intervalMonths?: number | null;
  reason?: string | null;
  gbuRef: string;
  lastCompletedAt: Date | null;
  now: Date;
}): DguvDeterminationDutyPatch {
  const coverageReason = input.reason?.trim() || input.gbuRef;

  if (input.state === "own_check") {
    const intervalValue = input.intervalMonths ?? null;
    if (intervalValue == null) {
      throw new Error("own_check requires intervalMonths");
    }
    return {
      applicable: true,
      suspendedAt: null,
      notApplicableReason: null,
      intervalValue,
      intervalUnit: "months",
      dueAt: input.lastCompletedAt
        ? addMonths(input.lastCompletedAt, intervalValue)
        : input.now,
    };
  }

  if (input.state === "covered_by_stk") {
    return {
      applicable: false,
      suspendedAt: input.now,
      notApplicableReason: overlapNotApplicableReason(coverageReason),
      dueAt: null,
      intervalValue: null,
      intervalUnit: null,
    };
  }

  return {
    applicable: false,
    suspendedAt: null,
    notApplicableReason: input.reason?.trim() || "entfaellt",
    dueAt: null,
    intervalValue: null,
    intervalUnit: null,
  };
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}
