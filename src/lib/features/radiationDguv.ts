/**
 * Tenant feature flag for Nachtrag 4 (E85–E91) — Strahlenschutz / DGUV.
 * Schema: Tenant.featureFlags JSON `{ "radiation_dguv": true }`.
 * Default OFF — enable only for design-partner / demo tenants.
 */
import { forbidden } from "@/lib/errors";

export type RadiationDguvFlags = {
  radiation_dguv?: boolean;
};

export function parseRadiationDguvFlags(raw: unknown): RadiationDguvFlags {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  return {
    radiation_dguv: obj.radiation_dguv === true,
  };
}

export function isRadiationDguvEnabled(featureFlags: unknown): boolean {
  return parseRadiationDguvFlags(featureFlags).radiation_dguv === true;
}

export function requireRadiationDguvEnabled(featureFlags: unknown): void {
  if (!isRadiationDguvEnabled(featureFlags)) {
    throw forbidden("Radiation / DGUV feature is not enabled for this tenant");
  }
}
