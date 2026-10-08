import type { MenuModule, PermissionSlug } from "@/interfaces/permissions";
import type { PartnerAppRole } from "@/interfaces/management";

export const ORG_ROLES = [
  "institution",
  "service_provider",
  "inspection_partner",
  "platform_operator",
] as const;

export type OrganisationRoleSlug = (typeof ORG_ROLES)[number];

export const CONTRACT_SCOPE_TOKENS = [
  "inventory",
  "due-dates",
  "inspection",
  "reprocessing",
  "training",
] as const;
export type ContractScopeToken = (typeof CONTRACT_SCOPE_TOKENS)[number];

const SCOPE_ALIASES: Record<string, ContractScopeToken> = {
  inventory: "inventory",
  bestand: "inventory",
  "due-dates": "due-dates",
  fristen: "due-dates",
  inspection: "inspection",
  pruefung: "inspection",
  prüfung: "inspection",
  reprocessing: "reprocessing",
  aufbereitung: "reprocessing",
  training: "training",
  schulung: "training",
};

const INVENTORY_SCOPE: readonly PermissionSlug[] = [
  "inventory:view",
  "inventory:update",
  "catalog:view",
  "clarifications:view",
  "locations:view",
  "locations:create",
  "locations:update",
  "locations:delete",
];

const DUE_DATES_SCOPE: readonly PermissionSlug[] = ["duties:view"];

const INSPECTION_SCOPE: readonly PermissionSlug[] = [
  "requests:create",
  "requests:view-mine",
  "requests:view-open",
  "requests:view-all",
  "requests:transition",
  "parts:request",
  "inspections:perform",
  "inspections:view",
  "catalogues:view",
  "qualifications:view",
];

/** Reprocessing scope: inventory + clarifications visibility (no clinic training). */
const REPROCESSING_SCOPE: readonly PermissionSlug[] = [
  "inventory:view",
  "clarifications:view",
  "locations:view",
];

/** Training scope is commercial only — acting still strips training:view. */
const TRAINING_SCOPE: readonly PermissionSlug[] = [];

export const SCOPE_PERMISSIONS: Record<ContractScopeToken, readonly PermissionSlug[]> = {
  inventory: INVENTORY_SCOPE,
  "due-dates": DUE_DATES_SCOPE,
  inspection: INSPECTION_SCOPE,
  reprocessing: REPROCESSING_SCOPE,
  training: TRAINING_SCOPE,
};

export const PARTNER_FORBIDDEN_PERMISSIONS: readonly PermissionSlug[] = [
  "users:view",
  "users:create",
  "users:update",
  "users:delete",
  "users:resetpassword",
  "roles:view",
  "roles:update",
  "training:view",
  "settings:view",
  "settings:oxid",
  "catalog:update",
];

const FORBIDDEN = new Set<PermissionSlug>(PARTNER_FORBIDDEN_PERMISSIONS);

const ADMIN_BASE: readonly PermissionSlug[] = [
  "shell:nav",
  "inventory:view",
  "inventory:update",
  "catalog:view",
  "clarifications:view",
  "locations:view",
  "locations:update",
  "duties:view",
  "requests:create",
  "requests:view-mine",
  "requests:view-open",
  "requests:view-all",
  "requests:transition",
  "parts:request",
  "inspections:perform",
  "inspections:view",
  "catalogues:view",
  "qualifications:view",
  "audit:view",
  "audit:export",
];

const INSPECTOR_BASE: readonly PermissionSlug[] = [
  "inventory:view",
  "catalog:view",
  "duties:view",
  "requests:view-open",
  "requests:transition",
  "inspections:perform",
  "inspections:view",
  "catalogues:view",
  "qualifications:view",
  "audit:view",
];

const ORDER_BASE: readonly PermissionSlug[] = [
  "duties:view",
  "requests:create",
  "requests:view-mine",
  "requests:view-open",
  "requests:view-all",
  "requests:transition",
  "parts:request",
  "audit:view",
];

export const PARTNER_ROLE_PERMISSIONS: Record<PartnerAppRole, readonly PermissionSlug[]> = {
  admin: ADMIN_BASE,
  inspector: INSPECTOR_BASE,
  order: ORDER_BASE,
};

/** All console capability slugs (admin baseline). */
export const ALL_CONSOLE_PERMISSIONS: readonly PermissionSlug[] = [
  "console:nav",
  "console:customers:view",
  "console:customers:create",
  "console:contracts:update",
  "console:contracts:lifecycle",
  "console:due-dates:view",
  "console:disposition:view",
  "console:disposition:assign",
  "console:assignments:view",
  "console:staff:view",
  "console:staff:invite",
  "console:staff:assign",
  "console:external:view",
  "console:external:manage",
  "console:organisation:view",
  "console:audit:view",
  "console:settings:view",
  "console:settings:smtp",
  "catalogues:view",
  "catalogues:edit",
  "inspections:view",
  "testequipment:manage",
  "qualifications:view",
  "qualifications:manage",
];

const CONSOLE_VIEW_BASE: readonly PermissionSlug[] = [
  "console:nav",
  "console:customers:view",
  "console:due-dates:view",
  "console:disposition:view",
  "console:assignments:view",
  "console:organisation:view",
  "console:audit:view",
  "catalogues:view",
  "inspections:view",
  "qualifications:view",
];

/** Operator-console grants by OrgMembership.appRole (no acting tenant). */
export const CONSOLE_ROLE_PERMISSIONS: Record<PartnerAppRole, readonly PermissionSlug[]> = {
  admin: ALL_CONSOLE_PERMISSIONS,
  inspector: [...CONSOLE_VIEW_BASE, "testequipment:manage"],
  order: [
    "console:nav",
    "console:customers:view",
    "console:due-dates:view",
    "console:disposition:view",
    "console:disposition:assign",
    "console:assignments:view",
  ],
};

export const CONSOLE_MENU_MODULES: readonly MenuModule[] = [
  {
    id: "console-customers",
    label: "Customers",
    href: "/partner/customers",
    slug: "console:customers:view",
    group: "ops",
  },
  {
    id: "console-due-dates",
    label: "Due dates",
    href: "/partner/due-dates",
    slug: "console:due-dates:view",
    group: "ops",
  },
  {
    id: "console-my-sites",
    label: "My institutions",
    href: "/partner/my-sites",
    slug: "console:disposition:view",
    group: "ops",
  },
  {
    id: "console-disposition",
    label: "Orders",
    href: "/partner/disposition",
    slug: "console:disposition:view",
    group: "ops",
  },
  {
    id: "console-assignments",
    label: "Inspection orders",
    href: "/partner/inspection-orders",
    slug: "console:assignments:view",
    group: "ops",
  },
  {
    id: "console-staff",
    label: "Staff",
    href: "/partner/staff",
    slug: "console:staff:view",
    group: "org",
  },
  {
    id: "console-external",
    label: "External inspectors",
    href: "/partner/external-inspectors",
    slug: "console:external:view",
    group: "org",
  },
  {
    id: "console-organisation",
    label: "Own organisation",
    href: "/partner/organisation",
    slug: "console:organisation:view",
    group: "org",
  },
  {
    id: "console-activity",
    label: "Activity log",
    href: "/partner/activity",
    slug: "console:audit:view",
    group: "org",
  },
  {
    id: "console-settings",
    label: "Settings",
    href: "/partner/settings",
    slug: "console:settings:view",
    group: "org",
  },
];

/** Exact / prefix path → required console slug. */
export const CONSOLE_PATH_PERMISSION_MAP: Record<string, PermissionSlug> = {
  "/partner": "console:customers:view",
  "/partner/customers": "console:customers:view",
  "/partner/customers/new": "console:customers:create",
  "/partner/due-dates": "console:due-dates:view",
  "/partner/my-sites": "console:disposition:view",
  "/partner/disposition": "console:disposition:view",
  "/partner/inspection-orders": "console:assignments:view",
  "/partner/staff": "console:staff:view",
  "/partner/external-inspectors": "console:external:view",
  "/partner/organisation": "console:organisation:view",
  "/partner/activity": "console:audit:view",
  "/partner/settings": "console:settings:view",
};

export function normalizeContractScope(raw: string[]): ContractScopeToken[] {
  const out = new Set<ContractScopeToken>();
  for (const token of raw) {
    const mapped = SCOPE_ALIASES[token.trim().toLowerCase()];
    if (mapped) out.add(mapped);
  }
  return [...out];
}

export function parseContractScope(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

function stripForbidden(slugs: Iterable<PermissionSlug>): PermissionSlug[] {
  return [...slugs].filter((slug) => !FORBIDDEN.has(slug));
}

function normalizePartnerAppRole(appRole: PartnerAppRole | string): PartnerAppRole {
  return appRole === "admin" || appRole === "order" || appRole === "inspector" ? appRole : "inspector";
}

/** Partner appRole grants with reserved slugs removed. Clinic-acting baseline (no console:*). */
export function partnerOrgPermissions(appRole: PartnerAppRole | string): PermissionSlug[] {
  const role = normalizePartnerAppRole(appRole);
  return stripForbidden(PARTNER_ROLE_PERMISSIONS[role]);
}

/** Console-only grants for Betreiberkonsole (no acting tenant). */
export function partnerConsolePermissions(appRole: PartnerAppRole | string): PermissionSlug[] {
  return [...CONSOLE_ROLE_PERMISSIONS[normalizePartnerAppRole(appRole)]];
}

export function consoleMenuFromPermissions(permissions: readonly PermissionSlug[]): MenuModule[] {
  const set = new Set(permissions);
  if (!set.has("console:nav")) return [];
  return CONSOLE_MENU_MODULES.filter((m) => set.has(m.slug));
}

/** First console href the user may open, or null. */
export function firstConsoleHomePath(permissions: readonly PermissionSlug[]): string | null {
  const menu = consoleMenuFromPermissions(permissions);
  return menu[0]?.href ?? null;
}

export function resolveConsolePathPermission(path: string): PermissionSlug | null {
  const bare = path.split("?")[0]?.split("#")[0] || "/partner";
  const pathname = bare.length > 1 && bare.endsWith("/") ? bare.slice(0, -1) : bare;
  if (CONSOLE_PATH_PERMISSION_MAP[pathname]) return CONSOLE_PATH_PERMISSION_MAP[pathname];
  if (pathname.startsWith("/partner/customers/")) return "console:customers:view";
  if (pathname.startsWith("/partner/my-sites/")) return "console:disposition:view";
  if (pathname.startsWith("/partner/test-equipment")) return "testequipment:manage";
  if (pathname.startsWith("/partner/staff/")) return "console:staff:view";
  if (pathname.startsWith("/partner/external-inspectors/")) return "console:external:view";
  if (pathname.startsWith("/partner/disposition/")) return "console:disposition:view";
  if (pathname.startsWith("/partner/")) return null;
  return null;
}

/**
 * Path-level RBAC for /partner/* (PartnerRouteGuard).
 * Requires console:nav plus the path’s console slug (except create which uses create slug).
 */
export function canAccessConsolePath(
  path: string,
  granted: ReadonlySet<PermissionSlug> | readonly PermissionSlug[],
): boolean {
  const slugSet = granted instanceof Set ? granted : new Set(granted);
  const required = resolveConsolePathPermission(path);
  if (!required) return false;
  if (!slugSet.has(required)) return false;
  if (required === "console:customers:create") return true;
  return slugSet.has("console:nav");
}

/** Effective partner grants on a tenant: role ∩ union(scope) minus reserved slugs. */
export function intersectPartnerGrantsWithScope(
  roleGrants: readonly PermissionSlug[],
  scope: string[],
): PermissionSlug[] {
  const tokens = normalizeContractScope(scope);
  if (tokens.length === 0) return [];
  const roleSet = new Set(stripForbidden(roleGrants));
  const scopeSet = new Set<PermissionSlug>();
  for (const token of tokens) {
    for (const slug of SCOPE_PERMISSIONS[token]) scopeSet.add(slug);
  }
  return stripForbidden(
    [...roleSet].filter(
      (slug) => scopeSet.has(slug) || slug === "audit:view" || slug === "audit:export" || slug === "shell:nav",
    ),
  );
}

/** Effective partner grants on a tenant: role ∩ union(scope) minus reserved slugs. */
export function intersectPartnerPermissions(
  appRole: PartnerAppRole | string,
  scope: string[],
): PermissionSlug[] {
  return intersectPartnerGrantsWithScope(partnerOrgPermissions(appRole), scope);
}

/**
 * Audit + shell stay available whenever the partner has any live scope,
 * so they can see their own actions. Export still requires admin role (stripped above if not).
 * Uses static PARTNER_ROLE_PERMISSIONS — prefer DB-backed grants via capabilitiesService.
 */
export function partnerActingPermissions(
  appRole: PartnerAppRole | string,
  scope: string[],
): PermissionSlug[] {
  return intersectPartnerGrantsWithScope(partnerOrgPermissions(appRole), scope);
}

/** Static fallback check — runtime prefer getCachedPartnerConsolePermissions after cache warm. */
export function partnerHasConsolePermission(
  appRole: PartnerAppRole | string,
  ...slugs: PermissionSlug[]
): boolean {
  const granted = new Set(partnerConsolePermissions(appRole));
  return slugs.some((s) => granted.has(s));
}
