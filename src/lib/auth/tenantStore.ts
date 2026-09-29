import { AsyncLocalStorage } from "node:async_hooks";

type TenantStoreState = {
  tenantId: string | null;
  /** When true, Prisma tenant extension is bypassed (seed, cron, scripts). */
  bypass: boolean;
};

const storage = new AsyncLocalStorage<TenantStoreState>();

export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return storage.run({ tenantId, bypass: false }, fn);
}

export async function runWithTenantAsync<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  // Nested async callback keeps ALS across awaits under Next.js request handling.
  return storage.run({ tenantId, bypass: false }, async () => fn());
}

/** Bypass tenant injection — seed, jobs that fan out across tenants, maintenance scripts. */
export function runWithoutTenant<T>(fn: () => T): T {
  return storage.run({ tenantId: null, bypass: true }, fn);
}

export async function runWithoutTenantAsync<T>(fn: () => Promise<T>): Promise<T> {
  return storage.run({ tenantId: null, bypass: true }, async () => fn());
}

/**
 * Bind tenant for the remainder of the current async resource (Next.js request).
 * Prefer this from requireTenantContext / requireActingContext so route handlers
 * do not need an explicit wrapper.
 */
export function bindTenant(tenantId: string): void {
  storage.enterWith({ tenantId, bypass: false });
}

export function bindTenantBypass(): void {
  storage.enterWith({ tenantId: null, bypass: true });
}

export function getTenantStore(): TenantStoreState | undefined {
  return storage.getStore();
}

export function getTenantIdOrThrow(): string {
  const store = storage.getStore();
  if (!store || store.bypass) {
    throw new Error("Tenant context required: call requireTenantContext / requireActingContext first.");
  }
  if (!store.tenantId) {
    throw new Error("Tenant context is empty.");
  }
  return store.tenantId;
}

export function isTenantBypass(): boolean {
  return Boolean(storage.getStore()?.bypass);
}
