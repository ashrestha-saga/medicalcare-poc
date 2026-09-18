import type { CapabilitiesResponse } from "@/interfaces/permissions";
import type { UserRole } from "@/interfaces/session";
import { menuFromPermissions } from "@/constants/permissions";
import {
  ensureRoleGrantCache,
  getCachedPermissions,
} from "@/services/roles/roleGrantsService";

/** Resolve capabilities from DB-backed role grants (Phase B). */
export async function resolveCapabilities(role: UserRole): Promise<CapabilitiesResponse> {
  await ensureRoleGrantCache();
  const permissions = [...getCachedPermissions(role)];
  return {
    role,
    permissions,
    menu: menuFromPermissions(permissions),
  };
}
