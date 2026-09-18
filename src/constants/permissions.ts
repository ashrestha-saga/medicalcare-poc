import type { MenuModule, PermissionSlug } from "@/interfaces/permissions";
import type { UserRole } from "@/interfaces/session";
import { isAlwaysAllowPath } from "@/constants/authRoutes";

/** Full permission catalog. Superadmin receives every slug by default. */
export const ALL_PERMISSIONS: readonly PermissionSlug[] = [
  "shell:nav",
  "inventory:view",
  "inventory:update",
  "catalog:view",
  "catalog:update",
  "clarifications:view",
  "requests:create",
  "parts:request",
  "requests:view-mine",
  "requests:view-open",
  "requests:view-all",
  "requests:transition",
  "account:security",
  "settings:view",
  "settings:oxid",
  "users:view",
  "users:create",
  "users:update",
  "users:delete",
  "users:resetpassword",
  "locations:view",
  "locations:create",
  "locations:update",
  "locations:delete",
  "roles:view",
  "roles:update",
] as const;

/** Staff who manage the service queue — includes the nav rail. */
const SERVICE_STAFF: readonly PermissionSlug[] = [
  "shell:nav",
  "inventory:view",
  "catalog:view",
  "requests:create",
  "parts:request",
  "requests:view-mine",
  "requests:view-open",
  "requests:transition",
  "account:security",
];

/**
 * Static role → permission map — used as seed defaults / fallback when RoleGrant is empty.
 * Runtime grants load from DB (Phase B) via roleGrantsService.
 *
 * `shell:nav` — left rail. Without it, only the app home (`/`) is routable;
 * Logout moves to the account bar.
 * `catalog:update` — central DeviceModel writes (superadmin + device_admin only).
 * `roles:update` — edit RoleGrant rows (superadmin by default).
 */
export const ROLE_PERMISSIONS: Record<UserRole, readonly PermissionSlug[]> = {
  superadmin: ALL_PERMISSIONS,
  device_admin: [...SERVICE_STAFF, "inventory:update", "catalog:update", "clarifications:view"],
  security_officer: [...SERVICE_STAFF, "requests:view-all"],
  // No shell:nav → Inventory-only chrome; /requests is blocked by RouteGuard.
  // /security is allowed without shell:nav (see canAccessPath).
  user: ["inventory:view", "requests:create", "parts:request", "requests:view-mine", "account:security"],
};

/** Permissions that cannot be removed from the superadmin role. */
export const SUPERADMIN_LOCKED_PERMISSIONS: readonly PermissionSlug[] = [
  "shell:nav",
  "roles:view",
  "roles:update",
  "users:view",
  "users:update",
  "account:security",
] as const;

/** Sidebar modules. Visibility = `shell:nav` + module slug. */
export const MENU_MODULES: readonly MenuModule[] = [
  { id: "inventory", label: "Inventory", href: "/devices", slug: "inventory:view" },
  { id: "catalog", label: "Catalog", href: "/catalog", slug: "catalog:view" },
  { id: "clarifications", label: "Clarifications", href: "/clarifications", slug: "clarifications:view" },
  { id: "requests", label: "Requests", href: "/requests", slug: "requests:view-mine" },
  { id: "users", label: "Users", href: "/users", slug: "users:view" },
  { id: "locations", label: "Locations", href: "/locations", slug: "locations:view" },
  { id: "roles", label: "Roles", href: "/roles", slug: "roles:view" },
  { id: "security", label: "Security", href: "/security", slug: "account:security" },
  { id: "settings", label: "Settings", href: "/settings", slug: "settings:view" },
];

/** Exact path → required resource slug (in addition to shell:nav for non-home). */
export const PATH_PERMISSION_MAP: Record<string, PermissionSlug> = {
  "/": "inventory:view",
  "/devices": "inventory:view",
  "/catalog": "catalog:view",
  "/clarifications": "clarifications:view",
  "/requests": "requests:view-mine",
  "/users": "users:view",
  "/locations": "locations:view",
  "/roles": "roles:view",
  "/security": "account:security",
  "/settings": "settings:view",
};

export const APP_HOME_PATH = "/";

export function permissionsForRole(role: UserRole): readonly PermissionSlug[] {
  return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.user;
}

export function hasPermission(role: UserRole | undefined, slug: PermissionSlug): boolean {
  if (!role) return false;
  return permissionsForRole(role).includes(slug);
}

export function menuForRole(role: UserRole): MenuModule[] {
  if (!hasPermission(role, "shell:nav")) return [];
  return MENU_MODULES.filter((m) => hasPermission(role, m.slug));
}

/** Build sidebar from an explicit grant list (Phase B DB-backed capabilities). */
export function menuFromPermissions(permissions: readonly PermissionSlug[]): MenuModule[] {
  const set = new Set(permissions);
  if (!set.has("shell:nav")) return [];
  return MENU_MODULES.filter((m) => set.has(m.slug));
}

export function normalizeAppPath(path: string): string {
  if (!path) return APP_HOME_PATH;
  const bare = path.split("?")[0]?.split("#")[0] || APP_HOME_PATH;
  if (bare.length > 1 && bare.endsWith("/")) return bare.slice(0, -1);
  return bare;
}

export function resolvePathPermission(path: string): PermissionSlug | null {
  const pathname = normalizeAppPath(path);
  if (PATH_PERMISSION_MAP[pathname]) return PATH_PERMISSION_MAP[pathname];
  if (pathname.startsWith("/devices")) return "inventory:view";
  if (pathname.startsWith("/catalog")) return "catalog:view";
  if (pathname.startsWith("/clarifications")) return "clarifications:view";
  if (pathname.startsWith("/requests")) return "requests:view-mine";
  if (pathname.startsWith("/users")) return "users:view";
  if (pathname.startsWith("/locations")) return "locations:view";
  if (pathname.startsWith("/roles")) return "roles:view";
  if (pathname.startsWith("/security")) return "account:security";
  if (pathname.startsWith("/settings")) return "settings:view";
  return null;
}

/**
 * Path-level RBAC used by RouteGuard (and tests).
 * - Always-allow paths (e.g. /login) pass.
 * - Home `/` needs only its resource slug (works without shell:nav).
 * - `/security` needs only account:security (works without shell:nav for capturers).
 * - Any other app path needs `shell:nav` plus the path’s resource slug.
 */
export function canAccessPath(
  path: string,
  granted: ReadonlySet<PermissionSlug> | readonly PermissionSlug[],
): boolean {
  const slugSet = granted instanceof Set ? granted : new Set(granted);
  const pathname = normalizeAppPath(path);
  if (isAlwaysAllowPath(pathname)) return true;

  const required = resolvePathPermission(pathname);
  if (!required) return false;
  if (!slugSet.has(required)) return false;

  if (pathname === APP_HOME_PATH || pathname === "/security" || pathname.startsWith("/security")) {
    return true;
  }
  if (!slugSet.has("shell:nav")) return false;
  return true;
}
