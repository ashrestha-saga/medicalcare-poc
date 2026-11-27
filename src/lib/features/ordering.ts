/**
 * Tenant feature flag for shop-led ordering.
 * Schema: Tenant.featureFlags JSON `{ "ordering": true }`.
 */
import { forbidden } from "@/lib/errors";

export function isOrderingEnabled(featureFlags: unknown): boolean {
  if (!featureFlags || typeof featureFlags !== "object" || Array.isArray(featureFlags)) return false;
  return (featureFlags as Record<string, unknown>).ordering === true;
}

export function requireOrderingEnabled(featureFlags: unknown): void {
  if (!isOrderingEnabled(featureFlags)) {
    throw forbidden("Ordering is not enabled for this tenant");
  }
}
