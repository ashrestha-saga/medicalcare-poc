/**
 * OXID Merzljak routing — logical path → `index.php?cl=&fnc=`.
 */
import { env } from "@/lib/env";

export function oxidEndpoint(cl: string, fnc?: string): string {
  const base = env.oxid.apiBaseUrl || env.oxid.tokenUrl.replace(/\?.*$/, "") || "";
  if (!base) throw new Error("OXID_API_BASE_URL (or OXID_TOKEN_URL) is not configured");
  const url = new URL(base.includes("index.php") ? base : `${base.replace(/\/$/, "")}/index.php`);
  url.searchParams.set("cl", cl);
  if (fnc) url.searchParams.set("fnc", fnc);
  return url.toString();
}
