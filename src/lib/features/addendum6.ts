/**
 * Tenant feature flags for Addendum 6 (E103–E108).
 * Schema: Tenant.featureFlags JSON keys below. Defaults OFF except where noted.
 */
import { forbidden } from "@/lib/errors";

export type Addendum6Flags = {
  /** E103 — import last performances → provisional duties. */
  importProvisionalDuties?: boolean;
  /** E105 — IFU function checks / Routinen heute. */
  routineChecks?: boolean;
  /** E107 — person inbox + digest. */
  notifications?: boolean;
};

export function parseAddendum6Flags(raw: unknown): Addendum6Flags {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  return {
    importProvisionalDuties: obj.importProvisionalDuties === true,
    routineChecks: obj.routineChecks === true,
    notifications: obj.notifications === true,
  };
}

export function isImportProvisionalDutiesEnabled(featureFlags: unknown): boolean {
  return parseAddendum6Flags(featureFlags).importProvisionalDuties === true;
}

export function isRoutineChecksEnabled(featureFlags: unknown): boolean {
  return parseAddendum6Flags(featureFlags).routineChecks === true;
}

export function isNotificationsEnabled(featureFlags: unknown): boolean {
  return parseAddendum6Flags(featureFlags).notifications === true;
}

export function requireImportProvisionalDuties(featureFlags: unknown): void {
  if (!isImportProvisionalDutiesEnabled(featureFlags)) {
    throw forbidden("Import provisional duties are not enabled for this tenant");
  }
}

export function requireRoutineChecks(featureFlags: unknown): void {
  if (!isRoutineChecksEnabled(featureFlags)) {
    throw forbidden("Routine checks are not enabled for this tenant");
  }
}

export function requireNotifications(featureFlags: unknown): void {
  if (!isNotificationsEnabled(featureFlags)) {
    throw forbidden("Notifications are not enabled for this tenant");
  }
}
