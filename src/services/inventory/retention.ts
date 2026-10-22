/** § 13 Abs. 3 MPBetreibV — book retention after decommission. */
export const RETENTION_YEARS = 5;

/** UTC calendar date at midnight. */
export function utcDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** retainUntil = decommissionedAt + 5 calendar years (date-only). */
export function computeRetainUntil(decommissionedAt: Date): Date {
  const base = utcDateOnly(decommissionedAt);
  return new Date(
    Date.UTC(base.getUTCFullYear() + RETENTION_YEARS, base.getUTCMonth(), base.getUTCDate()),
  );
}

export type RetentionClock = {
  decommissionedAt: Date;
  retainUntil: Date;
};

/**
 * Clock for first transition to retired.
 * Prefer explicit decommission day; fall back to retiredAt / now.
 */
export function retentionClockOnRetire(opts: {
  now?: Date;
  retiredAt?: Date | null;
}): RetentionClock {
  const now = opts.now ?? new Date();
  const decommissionedAt = utcDateOnly(opts.retiredAt ?? now);
  return {
    decommissionedAt,
    retainUntil: computeRetainUntil(decommissionedAt),
  };
}

/** True when purge/delete of book+instance is legally allowed. */
export function isPurgeAllowed(
  retainUntil: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!retainUntil) return false;
  return utcDateOnly(retainUntil).getTime() <= utcDateOnly(now).getTime();
}

export type RetentionStatus = "under_retention" | "purge_allowed" | "none";

export function retentionStatus(input: {
  state: string;
  retainUntil: Date | null | undefined;
  now?: Date;
}): RetentionStatus {
  if (input.state !== "retired") return "none";
  if (!input.retainUntil) return "under_retention";
  return isPurgeAllowed(input.retainUntil, input.now) ? "purge_allowed" : "under_retention";
}
