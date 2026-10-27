import { AsyncLocalStorage } from "node:async_hooks";

/**
 * While a DisclosureSession is open, clinic Prisma writes are blocked (R2).
 * Session close / disclosed / readiness upserts run inside this bypass.
 */
const store = new AsyncLocalStorage<{ bypass: boolean }>();

export function isDisclosureWriteBypass(): boolean {
  return Boolean(store.getStore()?.bypass);
}

export async function runWithDisclosureWriteBypass<T>(fn: () => Promise<T>): Promise<T> {
  return store.run({ bypass: true }, fn);
}
