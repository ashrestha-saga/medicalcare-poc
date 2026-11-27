import { unprocessable } from "@/lib/errors";

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

function isPrivateIpv4(hostname: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!m) return false;
  const parts = m.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/** Validate admin-supplied shop base URL (https only; block private hosts). */
export function assertSafeShopBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw unprocessable("Shop URL is not a valid URL.", { field: "shopBaseUrl" });
  }
  if (url.protocol !== "https:") {
    throw unprocessable("Shop URL must use https.", { field: "shopBaseUrl" });
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || isPrivateIpv4(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw unprocessable("Shop URL host is not allowed.", { field: "shopBaseUrl" });
  }
  if (url.username || url.password) {
    throw unprocessable("Shop URL must not include credentials.", { field: "shopBaseUrl" });
  }
  return `${url.protocol}//${url.host}${url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "")}`;
}

export function shopIndexUrl(shopBaseUrl: string, cl: string, fnc?: string): string {
  const base = shopBaseUrl.replace(/\/$/, "");
  const url = new URL(base.includes("index.php") ? base : `${base}/index.php`);
  url.searchParams.set("cl", cl);
  if (fnc) url.searchParams.set("fnc", fnc);
  return url.toString();
}

/** Origin of the shop (scheme + host + optional base path without index.php). */
export function shopOrigin(shopBaseUrl: string): string {
  const trimmed = shopBaseUrl.trim().replace(/\/$/, "");
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const path = url.pathname.replace(/\/index\.php$/i, "").replace(/\/$/, "");
    return `${url.origin}${path}`;
  } catch {
    return trimmed.replace(/\/index\.php$/i, "");
  }
}

/**
 * OXID master product picture URL.
 * Convention: `{origin}/out/pictures/master/product/{shopId}/{filename}`
 */
export function shopProductPictureUrl(
  shopBaseUrl: string,
  filename: string | null | undefined,
  shopId = "1",
): string | null {
  const file = filename?.trim();
  if (!file) return null;
  if (/^https?:\/\//i.test(file)) return file;
  const origin = shopOrigin(shopBaseUrl);
  const safeShop = encodeURIComponent(shopId || "1");
  const safeFile = file.split("/").map(encodeURIComponent).join("/");
  return `${origin}/out/pictures/master/product/${safeShop}/${safeFile}`;
}
