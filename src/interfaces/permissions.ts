import type { UserRole } from "./session";

/** Runtime capability key — `resource:action`. */
export type PermissionSlug =
  | "shell:nav"
  | "inventory:view"
  | "inventory:update"
  | "catalog:view"
  | "catalog:update"
  | "requests:create"
  | "parts:request"
  | "requests:view-mine"
  | "requests:view-open"
  | "requests:view-all"
  | "requests:transition"
  | "account:security"
  | "settings:view"
  | "settings:oxid"
  | "users:view"
  | "users:create"
  | "users:update"
  | "users:delete"
  | "users:resetpassword"
  | "locations:view"
  | "locations:create"
  | "locations:update"
  | "locations:delete"
  | "roles:view";

export type MenuModuleId =
  | "inventory"
  | "catalog"
  | "requests"
  | "users"
  | "locations"
  | "roles"
  | "settings"
  | "security";

export interface MenuModule {
  id: MenuModuleId;
  label: string;
  /** App path for this module. */
  href: string;
  slug: PermissionSlug;
}

export interface CapabilitiesResponse {
  role: UserRole;
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
  createdAt: string;
  updatedAt: string;
}

export interface RoleCatalogEntry {
  value: UserRole;
  label: string;
  permissions: PermissionSlug[];
  userCount: number;
}
