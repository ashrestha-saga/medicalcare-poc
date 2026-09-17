import type { OxidTokenSet } from "@/interfaces/external";

/**
 * SEC-900 — legacy in-memory token map (user-keyed). Tenant OXID tokens live in
 * TenantOxidConnection; this map is only for transitional helpers.
 */
export interface TokenStorage {
  get(userId: string): Promise<OxidTokenSet | null>;
  set(userId: string, tokens: OxidTokenSet): Promise<void>;
  clear(userId: string): Promise<void>;
}

class MemoryTokenStorage implements TokenStorage {
  private readonly tokens = new Map<string, OxidTokenSet>();
  async get(userId: string) {
    return this.tokens.get(userId) ?? null;
  }
  async set(userId: string, tokens: OxidTokenSet) {
    this.tokens.set(userId, tokens);
  }
  async clear(userId: string) {
    this.tokens.delete(userId);
  }
}

const globalForTokens = globalThis as unknown as { __devicecareTokens?: TokenStorage };
export const tokenStorage: TokenStorage = globalForTokens.__devicecareTokens ?? new MemoryTokenStorage();
if (process.env.NODE_ENV !== "production") globalForTokens.__devicecareTokens = tokenStorage;

export type PendingAuthPurpose = "tenant_connect";

export interface PendingAuthorization {
  codeVerifier: string;
  createdAt: number;
  returnTo: string;
  purpose: PendingAuthPurpose;
  tenantId: string;
  adminUserId: string;
}

const PENDING_TTL_MS = 10 * 60 * 1000;
const globalForPending = globalThis as unknown as { __devicecarePending?: Map<string, PendingAuthorization> };
const pending = globalForPending.__devicecarePending ?? new Map<string, PendingAuthorization>();
if (process.env.NODE_ENV !== "production") globalForPending.__devicecarePending = pending;

export const pendingAuthorizations = {
  put(state: string, value: PendingAuthorization) {
    pending.set(state, value);
  },
  take(state: string): PendingAuthorization | null {
    const v = pending.get(state);
    pending.delete(state);
    if (!v || Date.now() - v.createdAt > PENDING_TTL_MS) return null;
    return v;
  },
};
