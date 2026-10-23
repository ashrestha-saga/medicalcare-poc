import type { MenuModule, PermissionSlug } from "@/interfaces/permissions";
import type { UserRole } from "@/interfaces/session";
import { isAlwaysAllowPath } from "@/constants/authRoutes";

/** Full permission catalog. Superadmin receives every slug by default. */
export const ALL_PERMISSIONS: readonly PermissionSlug[] = [
  "shell:nav",
  "inventory:view",
  "inventory:update",
  "inventory:export",
  "catalog:view",
  "catalog:update",
  "clarifications:view",
  "duties:view",
  "requests:create",
  "parts:request",
  "requests:view-mine",
  "requests:view-open",
  "requests:view-all",
  "requests:transition",
  "account:security",
  "settings:view",
  "settings:oxid",
  "settings:smtp",
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
  "management:view",
  "training:view",
  "audit:view",
  "audit:export",
  "catalogues:view",
  "catalogues:edit",
  "inspections:perform",
  "inspections:view",
  "testequipment:manage",
  "qualifications:view",
  "qualifications:manage",
  "incidents:view",
  "incidents:manage",
  "fieldsafety:view",
  "fieldsafety:create",
  "devicebook:view",
  "reprocessing:view",
  "reprocessing:release",
  "authority:view",
] as const;

/** Staff who manage the service queue — includes the nav rail. */
const SERVICE_STAFF: readonly PermissionSlug[] = [
  "shell:nav",
  "inventory:view",
  "catalog:view",
  "duties:view",
  "training:view",
  "requests:create",
  "parts:request",
  "requests:view-mine",
  "requests:view-open",
  "requests:transition",
  "account:security",
  "management:view",
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
  device_admin: [
    ...SERVICE_STAFF,
    "inventory:update",
    "inventory:export",
    "catalog:update",
    "clarifications:view",
    "inspections:view",
    "catalogues:view",
    "qualifications:view",
    "audit:view",
    "devicebook:view",
    "fieldsafety:view",
    "fieldsafety:create",
    "incidents:view",
    "incidents:manage",
    "reprocessing:view",
    "reprocessing:release",
    "authority:view",
  ],
  security_officer: [
    ...SERVICE_STAFF,
    "inventory:export",
    "requests:view-all",
    "incidents:view",
    "incidents:manage",
    "fieldsafety:view",
    "fieldsafety:create",
    "devicebook:view",
  ],
  // No shell:nav → Inventory-only chrome; /requests is blocked by RouteGuard.
  // /security and /device-book are allowed without shell:nav (see canAccessPath).
  user: [
    "inventory:view",
    "requests:create",
    "parts:request",
    "requests:view-mine",
    "account:security",
    "devicebook:view",
  ],
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

/** Grouped permission catalog for the user create/edit matrix (mockup-aligned). */
export const PERMISSION_GROUPS: readonly {
  label: string;
  critical?: boolean;
  items: readonly { slug: PermissionSlug; description: string }[];
}[] = [
  {
    label: "Account and navigation",
    items: [
      { slug: "account:security", description: "Own security settings, password and second factor" },
      { slug: "shell:nav", description: "Access to the application and its navigation" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { slug: "inventory:view", description: "View device inventory" },
      { slug: "inventory:update", description: "Change and release device records" },
      { slug: "inventory:export", description: "Export §14 inventory directory (CSV)" },
      { slug: "clarifications:view", description: "View clarifications list" },
      { slug: "duties:view", description: "View duties and due dates" },
      { slug: "devicebook:view", description: "View medical device book entries" },
      { slug: "incidents:view", description: "View device incidents" },
      { slug: "incidents:manage", description: "Assess, report and close incidents" },
      { slug: "fieldsafety:view", description: "View field safety actions and recalls" },
      {
        slug: "fieldsafety:create",
        description: "Record recalls, match devices and close field safety actions",
      },
      { slug: "reprocessing:view", description: "View reprocessing checks and batches" },
      { slug: "reprocessing:release", description: "Release or reject reprocessing batches" },
      { slug: "authority:view", description: "View authority inspections and findings" },
    ],
  },
  {
    label: "Model catalog",
    items: [
      { slug: "catalog:view", description: "View model catalog" },
      { slug: "catalog:update", description: "Maintain models and classifications" },
    ],
  },
  {
    label: "Locations",
    items: [
      { slug: "locations:view", description: "View sites and areas" },
      { slug: "locations:create", description: "Create sites" },
      { slug: "locations:update", description: "Update sites, headcount and officers" },
      { slug: "locations:delete", description: "Remove sites" },
    ],
  },
  {
    label: "Requests and orders",
    items: [
      { slug: "requests:create", description: "Create service requests" },
      { slug: "requests:view-mine", description: "View own requests" },
      { slug: "requests:view-open", description: "View open facility requests" },
      { slug: "requests:view-all", description: "View all requests, including closed" },
      { slug: "requests:transition", description: "Transmit and advance request state" },
      { slug: "parts:request", description: "Request spare parts" },
    ],
  },
  {
    label: "Training and management",
    items: [
      { slug: "training:view", description: "View training and instruction records" },
      { slug: "management:view", description: "Management reports and overview" },
    ],
  },
  {
    label: "Users and roles",
    critical: true,
    items: [
      { slug: "users:view", description: "View users" },
      { slug: "users:create", description: "Create and invite users" },
      { slug: "users:update", description: "Update users, role and permissions" },
      { slug: "users:resetpassword", description: "Send password reset email" },
      { slug: "users:delete", description: "Remove users" },
      { slug: "roles:view", description: "View role catalog" },
      { slug: "roles:update", description: "Change roles and their presets" },
    ],
  },
  {
    label: "Settings",
    critical: true,
    items: [
      { slug: "settings:view", description: "View settings" },
      { slug: "settings:oxid", description: "Configure shop interface" },
      { slug: "settings:smtp", description: "Configure outbound SMTP for invitations and mail" },
    ],
  },
  {
    label: "Audit",
    critical: true,
    items: [
      { slug: "audit:view", description: "View activity and audit trail" },
      { slug: "audit:export", description: "Export audit events" },
    ],
  },
] as const;

export const CRITICAL_PERMISSIONS: ReadonlySet<PermissionSlug> = new Set(
  PERMISSION_GROUPS.filter((g) => g.critical).flatMap((g) => g.items.map((i) => i.slug)),
);

/**
 * Sidebar modules. Visibility = `shell:nav` + module slug.
 * Groups match mockup v26: Überblick → Geräte → Nachweise → Meldungen → Verwaltung.
 * Erstanlage / Klärliste / Security are not primary nav (chip, Bestand tab, Settings).
 */
export const MENU_MODULES: readonly MenuModule[] = [
  // Überblick — Dashboard unchanged (mockup “Heute”)
  { id: "dashboard", label: "Dashboard", href: "/dashboard", slug: "duties:view", group: "overview" },
  // Geräte
  { id: "inventory", label: "Inventory", href: "/devices", slug: "inventory:view", group: "devices" },
  { id: "due-dates", label: "Due dates", href: "/due-dates", slug: "duties:view", group: "devices" },
  { id: "requests", label: "Requests", href: "/requests", slug: "requests:view-mine", group: "devices" },
  // Nachweise
  { id: "device-book", label: "Device book", href: "/device-book", slug: "devicebook:view", group: "records" },
  { id: "reprocessing", label: "Reprocessing", href: "/reprocessing", slug: "reprocessing:view", group: "records" },
  { id: "constancy-cadence", label: "Constancy takt", href: "/constancy-cadence", slug: "duties:view", group: "records" },
  { id: "training", label: "Training", href: "/training", slug: "training:view", group: "records" },
  // Meldungen
  { id: "incidents", label: "Incidents", href: "/incidents", slug: "incidents:view", group: "reports" },
  { id: "field-safety", label: "Field safety", href: "/field-safety", slug: "fieldsafety:view", group: "reports" },
  { id: "authority", label: "Authority", href: "/authority", slug: "authority:view", group: "reports" },
  { id: "duty-overlap", label: "Duty overlap", href: "/duty-overlap", slug: "duties:view", group: "reports" },
  // Verwaltung (aufgeklappt by default in AppShell)
  { id: "locations", label: "Locations", href: "/locations", slug: "locations:view", group: "admin" },
  { id: "users", label: "Users", href: "/users", slug: "users:view", group: "admin" },
  { id: "catalog", label: "Catalog", href: "/catalog", slug: "catalog:view", group: "admin" },
  { id: "management", label: "Management", href: "/management", slug: "management:view", group: "admin" },
  { id: "roles", label: "Roles", href: "/roles", slug: "roles:view", group: "admin" },
  { id: "activity", label: "Activity", href: "/activity", slug: "audit:view", group: "admin" },
  // Secondary rail only
  { id: "settings", label: "Settings", href: "/settings", slug: "settings:view" },
];

/** Exact path → required resource slug (in addition to shell:nav for non-home). */
export const PATH_PERMISSION_MAP: Record<string, PermissionSlug> = {
  "/": "inventory:view",
  "/dashboard": "duties:view",
  "/dashboard/assignments": "roles:view",
  "/devices": "inventory:view",
  "/registration": "inventory:update",
  // /clarifications redirects to /devices?tab=klaerliste — keep path map for deep links
  "/due-dates": "duties:view",
  "/constancy-cadence": "duties:view",
  "/duty-overlap": "duties:view",
  "/training": "training:view",
  "/catalog": "catalog:view",
  "/clarifications": "clarifications:view",
  "/requests": "requests:view-mine",
  "/users": "users:view",
  "/locations": "locations:view",
  "/roles": "roles:view",
  "/management": "management:view",
  "/commissioning": "shell:nav",
  "/activity": "audit:view",
  "/security": "account:security",
  "/settings": "settings:view",
  "/incidents": "incidents:view",
  "/field-safety": "fieldsafety:view",
  "/device-book": "devicebook:view",
  "/reprocessing": "reprocessing:view",
  "/authority": "authority:view",
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
  if (pathname.startsWith("/registration")) return "inventory:update";
  if (pathname.startsWith("/due-dates")) return "duties:view";
  if (pathname.startsWith("/constancy-cadence")) return "duties:view";
  if (pathname.startsWith("/duty-overlap")) return "duties:view";
  if (pathname.startsWith("/training")) return "training:view";
  if (pathname.startsWith("/catalog")) return "catalog:view";
  if (pathname.startsWith("/clarifications")) return "clarifications:view";
  if (pathname.startsWith("/requests")) return "requests:view-mine";
  if (pathname.startsWith("/users")) return "users:view";
  if (pathname.startsWith("/locations")) return "locations:view";
  if (pathname.startsWith("/roles")) return "roles:view";
  if (pathname.startsWith("/management")) return "management:view";
  if (pathname.startsWith("/commissioning")) return "shell:nav";
  if (pathname.startsWith("/activity")) return "audit:view";
  if (pathname.startsWith("/security")) return "account:security";
  if (pathname.startsWith("/settings")) return "settings:view";
  if (pathname.startsWith("/dashboard")) return "duties:view";
  if (pathname.startsWith("/incidents")) return "incidents:view";
  if (pathname.startsWith("/field-safety")) return "fieldsafety:view";
  if (pathname.startsWith("/device-book")) return "devicebook:view";
  if (pathname.startsWith("/reprocessing")) return "reprocessing:view";
  if (pathname.startsWith("/authority")) return "authority:view";
  return null;
}

/**
 * Path-level RBAC used by RouteGuard (and tests).
 * - Always-allow paths (e.g. /login) pass.
 * - Home `/` needs only its resource slug (works without shell:nav).
 * - `/security` needs only account:security (works without shell:nav for capturers).
 * - `/device-book` needs only devicebook:view (area-scoped capturers; no shell:nav).
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

  if (
    pathname === APP_HOME_PATH ||
    pathname === "/security" ||
    pathname.startsWith("/security") ||
    pathname === "/device-book" ||
    pathname.startsWith("/device-book")
  ) {
    return true;
  }
  if (!slugSet.has("shell:nav")) return false;
  return true;
}
