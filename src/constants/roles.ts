import type { UserRole } from "@/interfaces/session";

export const USER_ROLES: UserRole[] = [
  "superadmin",
  "device_admin",
  "security_officer",
  "user",
];

export const DEFAULT_USER_ROLE: UserRole = "user";

export const ROLES: { value: UserRole; label: string }[] = [
  { value: "superadmin", label: "Superadmin" },
  { value: "device_admin", label: "Device Administrator" },
  { value: "security_officer", label: "Security Officer" },
  { value: "user", label: "User" },
];

export const PIN_LENGTH = 4;
export const PIN_MAX_ATTEMPTS = 3; // SEC-901
export const IDLE_LOCK_MS = 5 * 60 * 1000;

export function roleLabel(role: UserRole | undefined): string {
  if (!role) return "—";
  return ROLES.find((r) => r.value === role)?.label ?? role;
}
