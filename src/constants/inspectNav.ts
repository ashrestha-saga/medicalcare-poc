/** Prüfpartner v10-A navigation — bands + presets (technician vs external). */

export type InspectNavKey =
  | "heute"
  | "woche"
  | "queue"
  | "erledigt"
  | "nachbesuche"
  | "zugang"
  | "kataloge";

export type InspectNavBand = "taeglich" | "regel" | "selten";

export const INSPECT_NAV_ITEMS: readonly {
  key: InspectNavKey;
  labelKey: string;
  href: string;
}[] = [
  { key: "heute", labelKey: "navHeute", href: "/inspect/heute" },
  { key: "woche", labelKey: "navWoche", href: "/inspect/woche" },
  { key: "queue", labelKey: "navQueue", href: "/inspect/queue" },
  { key: "erledigt", labelKey: "navErledigt", href: "/inspect/erledigt" },
  { key: "nachbesuche", labelKey: "navNachbesuche", href: "/inspect/nachbesuche" },
  { key: "zugang", labelKey: "navZugang", href: "/inspect/zugang" },
  { key: "kataloge", labelKey: "navKataloge", href: "/inspect/kataloge" },
] as const;

export const INSPECT_NAV_KEY_SET = new Set<string>(INSPECT_NAV_ITEMS.map((i) => i.key));

/** Technician preset (internal). External inspectors use `fremd`. */
export const INSPECT_NAV_PRESETS: Record<
  "techniker" | "fremd",
  { taeglich: InspectNavKey[]; regel: InspectNavKey[]; selten: InspectNavKey[] }
> = {
  techniker: {
    taeglich: ["heute", "woche", "queue"],
    regel: ["erledigt", "nachbesuche"],
    selten: ["zugang", "kataloge"],
  },
  fremd: {
    taeglich: ["heute", "woche"],
    regel: ["erledigt", "zugang"],
    selten: ["queue", "nachbesuche", "kataloge"],
  },
};

export const INSPECT_NAV_TAEGLICH_MAX = 4;
export const INSPECT_NAV_PINS_MAX = 3;

export function inspectNavItem(key: string) {
  return INSPECT_NAV_ITEMS.find((i) => i.key === key) ?? null;
}

export function isInspectProtocolPath(pathname: string): boolean {
  if (!pathname.startsWith("/inspect/")) return false;
  const seg = pathname.slice("/inspect/".length).split("/")[0] ?? "";
  if (!seg) return false;
  return !INSPECT_NAV_KEY_SET.has(decodeURIComponent(seg));
}

export function inspectNavKeyFromPath(pathname: string): InspectNavKey | null {
  if (pathname === "/inspect" || pathname === "/inspect/") return "heute";
  if (!pathname.startsWith("/inspect/")) return null;
  const seg = decodeURIComponent(pathname.slice("/inspect/".length).split("/")[0] ?? "");
  return INSPECT_NAV_KEY_SET.has(seg) ? (seg as InspectNavKey) : null;
}
