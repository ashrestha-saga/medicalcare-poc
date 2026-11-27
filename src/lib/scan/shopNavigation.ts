/** Relative in-app path only (blocks open redirects). */
export function safeAppPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (trimmed.includes("://")) return null;
  return trimmed;
}

/** Scan home that rehydrates the inventory device card after leaving for /shop. */
export function scanResumePath(deviceInstanceId: string): string {
  return `/?device=${encodeURIComponent(deviceInstanceId)}`;
}

/** Dedicated shop catalog for an inventory device, with optional return path. */
export function shopPathForDevice(
  deviceInstanceId: string,
  returnTo?: string,
  opts?: { tab?: "device" | "accessories" | "suggestions" },
): string {
  const q = new URLSearchParams();
  q.set("device", deviceInstanceId);
  const safe = safeAppPath(returnTo);
  if (safe) q.set("returnTo", safe);
  // Spare-parts entry should open Accessories (not the matched device article).
  if (opts?.tab) q.set("tab", opts.tab);
  return `/shop?${q.toString()}`;
}
