/** Prefix on DeviceDuty.notApplicableReason when suspended by a DutyOverlapDecision. */
export const OVERLAP_REASON_PREFIX = "overlap:";

export function overlapNotApplicableReason(reasonText: string): string {
  return `${OVERLAP_REASON_PREFIX}${reasonText.trim()}`;
}

export function isOverlapSuspensionReason(reason: string | null | undefined): boolean {
  return Boolean(reason?.startsWith(OVERLAP_REASON_PREFIX));
}
