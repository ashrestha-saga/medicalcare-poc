/**
 * In-memory sliding-window rate limiter for external lookups (Section 32).
 * Per-process only — sufficient for a single Next.js instance; swap for a
 * shared store (Redis / DB table) when running multiple instances.
 */

interface Bucket {
  hits: number[];
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Returns true when the call is allowed and records it. */
  tryAcquire(key: string): boolean {
    const t = this.now();
    const bucket = this.buckets.get(key) ?? { hits: [] };
    bucket.hits = bucket.hits.filter((h) => t - h < this.windowMs);
    if (bucket.hits.length >= this.limit) {
      this.buckets.set(key, bucket);
      return false;
    }
    bucket.hits.push(t);
    this.buckets.set(key, bucket);
    return true;
  }

  remaining(key: string): number {
    const t = this.now();
    const bucket = this.buckets.get(key);
    if (!bucket) return this.limit;
    return Math.max(0, this.limit - bucket.hits.filter((h) => t - h < this.windowMs).length);
  }

  reset(): void {
    this.buckets.clear();
  }
}

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
