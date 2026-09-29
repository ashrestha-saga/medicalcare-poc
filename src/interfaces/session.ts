import type { ActorContext, RequestMeta } from "./audit";
import type { PartnerAppRole } from "./management";
import type { PermissionSlug } from "./permissions";

export type UserRole = "superadmin" | "device_admin" | "security_officer" | "user";

export type AccountKind = "clinic" | "partner";

export interface SessionUser {
  id: string;
  name: string;
  accountKind: AccountKind;
  /** Clinic role. Required when accountKind is clinic. */
  role?: UserRole;
  /** Clinic tenant scope. Required when accountKind is clinic. */
  tenantId?: string;
  /** Partner organisation. Required when accountKind is partner. */
  organisationId?: string;
  organisationName?: string;
  /** Partner membership role: admin | inspector | order. */
  appRole?: PartnerAppRole | string;
  /** OXID company name shown in the account bar (replaces seeded tenant labels). */
  companyName?: string | null;
  /** OXID customer number (`custnr`) when signed in via OAuth. */
  customerNumber?: string | null;
  /** Prefill for the account-bar delivery line (from Me address/billing). */
  deliveryLine?: string | null;
}

export type ClinicSessionUser = SessionUser & {
  accountKind: "clinic";
  role: UserRole;
  tenantId: string;
};

export type PartnerSessionUser = SessionUser & {
  accountKind: "partner";
  organisationId: string;
  organisationName: string;
  appRole: PartnerAppRole | string;
};

/** Shared tenant-scoped work (clinic session or partner-on-tenant). */
export interface ActingContext {
  tenantId: string;
  user: ClinicSessionUser | PartnerSessionUser;
  correlationId: string;
  requestMeta?: RequestMeta;
  permissions: readonly PermissionSlug[];
  actor: ActorContext;
}

/** Resolved on the server from the signed session cookie — never from the request body. */
export interface TenantContext {
  tenantId: string;
  user: ClinicSessionUser;
  correlationId: string;
  requestMeta?: RequestMeta;
  permissions?: readonly PermissionSlug[];
  actor?: ActorContext;
}

/** Clinic reserved routes stay TenantContext; shared services accept either door. */
export type TenantWorkContext = ActingContext | TenantContext;

/** Partner session scope — organisation, not clinic tenant. */
export interface PartnerContext {
  organisationId: string;
  user: PartnerSessionUser;
  correlationId: string;
  requestMeta?: RequestMeta;
}

export function isClinicSession(user: SessionUser | null | undefined): user is ClinicSessionUser {
  // Client session omits tenantId (blanked to ""); cookie still has it for server APIs.
  return Boolean(user && user.accountKind !== "partner" && user.role);
}

export function isPartnerSession(user: SessionUser | null | undefined): user is PartnerSessionUser {
  return Boolean(user && user.accountKind === "partner" && (user.organisationId || user.organisationName));
}

