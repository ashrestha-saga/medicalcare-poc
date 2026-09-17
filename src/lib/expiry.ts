/** SS-201 — BEUDAMED cache TTL helpers. Pure, testable. */

export const DAY_MS = 24 * 60 * 60 * 1000;

export function isFresh(fetchedAt: Date, ttlDays: number, now: Date = new Date()): boolean {
  return now.getTime() - fetchedAt.getTime() < ttlDays * DAY_MS;
}

export function expiresAt(fetchedAt: Date, ttlDays: number): Date {
  return new Date(fetchedAt.getTime() + ttlDays * DAY_MS);
}

/** True when a cached record is still valid but past 80% of its TTL — background refresh candidate. */
export function shouldBackgroundRefresh(fetchedAt: Date, ttlDays: number, now: Date = new Date()): boolean {
  const age = now.getTime() - fetchedAt.getTime();
  const ttl = ttlDays * DAY_MS;
  return age >= ttl * 0.8 && age < ttl;
}
