import { AsyncLocalStorage } from "node:async_hooks";

/**
 * While a DisclosureSession is open, clinic Prisma writes are blocked (R2).
 * Session close / disclosed / readiness upserts run inside this bypass.
 */
type DisclosureBypassState = { bypass: boolean };

const globalForDisclosure = globalThis as unknown as {
  __msrDisclosureWriteAls?: AsyncLocalStorage<DisclosureBypassState>;
};

const store =
  globalForDisclosure.__msrDisclosureWriteAls ??
  (globalForDisclosure.__msrDisclosureWriteAls = new AsyncLocalStorage<DisclosureBypassState>());

export function isDisclosureWriteBypass(): boolean {
  return Boolean(store.getStore()?.bypass);
}

export async function runWithDisclosureWriteBypass<T>(fn: () => Promise<T>): Promise<T> {
  return store.run({ bypass: true }, fn);
}
