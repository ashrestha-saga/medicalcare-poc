import type { UserRole } from "@/interfaces/session";

export const USER_ROLES: UserRole[] = [
  "superadmin",
  "device_admin",
  "security_officer",
  "user",
];

export const DEFAULT_USER_ROLE: UserRole = "user";

export const ROLES: { value: UserRole; label: string; description: string }[] = [
  {
    value: "superadmin",
    label: "Superadmin",
    description: "Manages users, roles and settings. Full access.",
  },
  {
    value: "device_admin",
    label: "Device Administrator",
    description: "Runs the inventory: registration, release, catalogue, assignments.",
  },
  {
    value: "security_officer",
    label: "Security Officer",
    description: "Medical device safety officer: sees everything, does not change the inventory.",
  },
  {
    value: "user",
    label: "User",
    description: "Ward user: sees the inventory, reports needs.",
  },
];

export function roleLabel(role: UserRole | undefined): string {
  if (!role) return "—";
  return ROLES.find((r) => r.value === role)?.label ?? role;
}
