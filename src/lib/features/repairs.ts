/**
 * Tenant feature flag for the E70–E80 repairs package.
 * Schema: Tenant.featureFlags JSON `{ "repairs": true }`.
 */
import { forbidden } from "@/lib/errors";

export type TenantFeatureFlags = {
  repairs?: boolean;
  /** Nachtrag 4 — Strahlenschutz / DGUV (E85–E91). */
  radiation_dguv?: boolean;
  /** Addendum 6 — E103 import → provisional duties. */
  importProvisionalDuties?: boolean;
  /** Addendum 6 — E105 IFU routines. */
  routineChecks?: boolean;
  /** Addendum 6 — E107 user notifications. */
  notifications?: boolean;
};

export function parseFeatureFlags(raw: unknown): TenantFeatureFlags {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  return {
    repairs: obj.repairs === true,
    radiation_dguv: obj.radiation_dguv === true,
    importProvisionalDuties: obj.importProvisionalDuties === true,
    routineChecks: obj.routineChecks === true,
    notifications: obj.notifications === true,
  };
}

export function isRepairsEnabled(featureFlags: unknown): boolean {
  return parseFeatureFlags(featureFlags).repairs === true;
}

export function requireRepairsEnabled(featureFlags: unknown): void {
  if (!isRepairsEnabled(featureFlags)) {
    throw forbidden("Repairs feature is not enabled for this tenant");
  }
}
