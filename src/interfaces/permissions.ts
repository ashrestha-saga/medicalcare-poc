import type { AccountKind, UserRole } from "./session";

/** Runtime capability key — `resource:action`. */
export type PermissionSlug =
  | "shell:nav"
  | "inventory:view"
  | "inventory:update"
  | "catalog:view"
  | "catalog:update"
  | "clarifications:view"
  | "duties:view"
  | "requests:create"
  | "parts:request"
  | "requests:view-mine"
  | "requests:view-open"
  | "requests:view-all"
  | "requests:transition"
  | "account:security"
  | "settings:view"
  | "settings:oxid"
  | "settings:smtp"
  | "users:view"
  | "users:create"
  | "users:update"
  | "users:delete"
  | "users:resetpassword"
  | "locations:view"
  | "locations:create"
  | "locations:update"
  | "locations:delete"
  | "roles:view"
  | "roles:update"
  | "management:view"
  | "training:view"
  | "audit:view"
  | "audit:export"
  | "console:nav"
  | "console:customers:view"
  | "console:customers:create"
  | "console:contracts:update"
  | "console:contracts:lifecycle"
  | "console:due-dates:view"
  | "console:disposition:view"
  | "console:disposition:assign"
  | "console:assignments:view"
  | "console:staff:view"
  | "console:staff:invite"
  | "console:staff:assign"
  | "console:external:view"
  | "console:external:manage"
  | "console:organisation:view"
  | "console:audit:view"
  | "console:settings:view"
  | "console:settings:smtp";

export type MenuModuleId =
  | "inventory"
  | "registration"
  | "due-dates"
  | "training"
  | "catalog"
  | "clarifications"
  | "requests"
  | "users"
  | "locations"
  | "roles"
  | "settings"
  | "security"
  | "management"
  | "activity"
  | "console-customers"
  | "console-due-dates"
  | "console-disposition"
  | "console-my-sites"
  | "console-assignments"
  | "console-staff"
  | "console-external"
  | "console-organisation"
  | "console-activity"
  | "console-settings";

export interface MenuModule {
  id: MenuModuleId;
  label: string;
  /** App path for this module. */
  href: string;
  slug: PermissionSlug;
  /** Nav section: clinic work | master | output; console ops | org. */
  group?: "work" | "master" | "output" | "ops" | "org";
}

export interface CapabilitiesResponse {
  role: UserRole | string;
  accountKind?: AccountKind;
  permissions: PermissionSlug[];
  menu: MenuModule[];
}

/** Tenant user row returned by admin APIs (never includes passwordHash). */
export interface AdminUserDTO {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  /** active | inactive for users; invited for pending UserInvitation rows. */
  status: "active" | "inactive" | "invited";
  /**
   * Per-user permission snapshot. null ⇒ follows RoleGrant for `role`.
   * For invited rows: snapshot from invitation, or null for role-only.
   */
  permissions: PermissionSlug[] | null;
  /** Set when status === "invited". */
  invitationId?: string | null;
  /** Invite expiry ISO string when status === "invited". */
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoleCatalogEntry {
  value: UserRole;
  label: string;
  permissions: PermissionSlug[];
  userCount: number;
}
