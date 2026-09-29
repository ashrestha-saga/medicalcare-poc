import type { CapabilitiesResponse } from "@/interfaces/permissions";
import type { PartnerAppRole } from "@/interfaces/management";
import type { UserRole } from "@/interfaces/session";
import { menuFromPermissions } from "@/constants/permissions";
import {
  consoleMenuFromPermissions,
  intersectPartnerGrantsWithScope,
} from "@/constants/partnerPermissions";
import {
  ensurePartnerRoleGrantCache,
  ensureRoleGrantCache,
  getCachedPartnerActingPermissions,
  getCachedPartnerConsolePermissions,
  getCachedPermissions,
  getEffectiveClinicPermissions,
} from "@/services/roles/roleGrantsService";

/**
 * Resolve clinic capabilities.
 * When `userId` is set, uses UserPermission snapshot (or RoleGrant if empty).
 */
export async function resolveCapabilities(
  role: UserRole,
  userId?: string,
): Promise<CapabilitiesResponse> {
  await ensureRoleGrantCache();
  const permissions = userId
    ? await getEffectiveClinicPermissions(userId, role)
    : [...getCachedPermissions(role)];
  return {
    role,
    accountKind: "clinic",
    permissions,
    menu: menuFromPermissions(permissions),
  };
}

/**
 * Partner capabilities (DB RoleGrant kind=partner_console | partner_acting):
 * - scope == null → Betreiberkonsole
 * - scope set → acting in a clinic (grants ∩ contract scope + clinic menu)
 */
export async function resolvePartnerCapabilities(
  appRole: PartnerAppRole | string,
  scope: string[] | null,
): Promise<CapabilitiesResponse> {
  await ensurePartnerRoleGrantCache();
  if (scope == null) {
    const permissions = [...getCachedPartnerConsolePermissions(appRole)];
    return {
      role: appRole,
      accountKind: "partner",
      permissions,
      menu: consoleMenuFromPermissions(permissions),
    };
  }
  const permissions = intersectPartnerGrantsWithScope(
    getCachedPartnerActingPermissions(appRole),
    scope,
  );
  return {
    role: appRole,
    accountKind: "partner",
    permissions,
    menu: menuFromPermissions(permissions),
  };
}
