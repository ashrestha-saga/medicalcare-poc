import type { CapabilitiesResponse } from "@/interfaces/permissions";
import type { UserRole } from "@/interfaces/session";
import { menuForRole, permissionsForRole } from "@/constants/permissions";

/** Resolve Phase A capabilities from the session role (static map). */
export function resolveCapabilities(role: UserRole): CapabilitiesResponse {
  return {
    role,
    permissions: [...permissionsForRole(role)],
    menu: menuForRole(role),
  };
}
