export type UserRole = "superadmin" | "device_admin" | "security_officer" | "user";

export interface SessionUser {
  id: string;
  name: string;
  role: UserRole;
  /** Internal data scope for Prisma rows (not shown in the UI). */
  tenantId: string;
  /** OXID company name shown in the account bar (replaces seeded tenant labels). */
  companyName?: string | null;
  /** OXID customer number (`custnr`) when signed in via OAuth. */
  customerNumber?: string | null;
  /** Prefill for the account-bar delivery line (from Me address/billing). */
  deliveryLine?: string | null;
}

/** Resolved on the server from the signed session cookie — never from the request body. */
export interface TenantContext {
  tenantId: string;
  user: SessionUser;
  correlationId: string;
}
