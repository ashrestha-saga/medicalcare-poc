import type { PartnerAppRole } from "@/interfaces/management";
import type { MenuModuleId } from "@/interfaces/permissions";
import { KNOWN_PARTNER_APP_ROLES } from "@/constants/partnerPermissions";

/** Nav keys aligned with Betreiberkonsole v14-A NAV_LABEL / NAV_BAENDER. */
export type ConsoleNavKey =
  | "heute"
  | "kunden"
  | "faellig"
  | "disposition"
  | "meine"
  | "mitarbeiter"
  | "fremd"
  | "organisation"
  | "protokoll"
  | "rueckrufe"
  | "settings";

export type ConsoleNavBand = "taeglich" | "regel" | "selten";

export const CONSOLE_NAV_KEY_TO_MODULE: Record<ConsoleNavKey, MenuModuleId> = {
  heute: "console-today",
  kunden: "console-customers",
  faellig: "console-due-dates",
  disposition: "console-orders",
  meine: "console-my-sites",
  mitarbeiter: "console-staff",
  fremd: "console-external",
  organisation: "console-organisation",
  protokoll: "console-activity",
  rueckrufe: "console-field-safety",
  settings: "console-settings",
};

/**
 * Role → frequency bands (v14-A).
 * admin=org superuser, management=GF, service_lead=Serviceleitung, inspector=Technik, order≈Besteller.
 */
export const CONSOLE_NAV_PRESETS: Record<
  PartnerAppRole,
  { taeglich: ConsoleNavKey[]; regel: ConsoleNavKey[]; selten: ConsoleNavKey[] }
> = {
  admin: {
    taeglich: ["heute", "disposition", "faellig", "kunden"],
    regel: ["meine", "mitarbeiter", "fremd"],
    selten: ["rueckrufe", "organisation", "protokoll"],
  },
  management: {
    taeglich: ["heute", "kunden", "disposition"],
    regel: ["meine", "mitarbeiter", "faellig"],
    selten: ["rueckrufe", "fremd", "organisation", "protokoll"],
  },
  service_lead: {
    taeglich: ["heute", "disposition", "faellig", "kunden"],
    regel: ["meine", "mitarbeiter"],
    selten: ["rueckrufe", "fremd", "protokoll", "organisation"],
  },
  inspector: {
    taeglich: ["heute", "meine", "disposition"],
    regel: [],
    selten: [],
  },
  order: {
    taeglich: ["heute", "disposition", "faellig", "kunden"],
    regel: ["meine"],
    selten: [],
  },
};

export type PartnerTileZone = "ent" | "vor" | "beob";

export type PartnerTileDef = {
  id: string;
  zone: PartnerTileZone;
  labelKey: string;
  href: string;
  roles: readonly PartnerAppRole[];
};

/**
 * Heute tile catalog + role assignment (v14-A KACHEL_ROLLE).
 * Zone 1 = ent (decides), capped at 3 after urgency sort.
 * `admin` is included on every tile (full access); service_lead keeps former admin set.
 */
export const PARTNER_TODAY_TILE_CATALOG: readonly PartnerTileDef[] = [
  {
    id: "ueberfaellig",
    zone: "ent",
    labelKey: "tileOverdue",
    href: "/partner/due-dates?overdue=1",
    roles: ["admin", "management", "service_lead"],
  },
  {
    id: "behoerdenfrist",
    zone: "ent",
    labelKey: "tileAuthorityDeadline",
    href: "/partner/orders?tab=disposition&reason=befund",
    roles: ["admin", "management", "service_lead"],
  },
  {
    id: "laeuftab",
    zone: "ent",
    labelKey: "tileExpiring90",
    href: "/partner/staff?expiring=1",
    roles: ["admin", "management", "service_lead"],
  },
  {
    id: "vertragende",
    zone: "ent",
    labelKey: "tileContractEnding",
    href: "/partner/customers?filter=ending",
    roles: ["admin", "management"],
  },
  {
    id: "p6",
    zone: "ent",
    labelKey: "tileMpsbOpen",
    href: "/partner/customers?filter=mpsb",
    roles: ["admin", "service_lead"],
  },
  {
    id: "inbetriebnahme",
    zone: "ent",
    labelKey: "tileSetupStuck",
    href: "/partner/customers?filter=setup",
    roles: ["admin", "management", "service_lead"],
  },
  {
    id: "ohneRueckfluss",
    zone: "ent",
    labelKey: "tileReturnFlow",
    href: "/partner/orders?tab=disposition&focus=return",
    roles: ["admin", "service_lead"],
  },
  {
    id: "ausserhalb",
    zone: "ent",
    labelKey: "tileOutOfContract",
    href: "/partner/orders?tab=disposition&focus=out_of_contract",
    roles: ["admin", "management", "service_lead"],
  },
  {
    id: "zuterm",
    zone: "vor",
    labelKey: "tileNeedsSchedule",
    href: "/partner/orders?tab=disposition&focus=unscheduled",
    roles: ["admin", "service_lead", "order"],
  },
  {
    id: "tandem",
    zone: "beob",
    labelKey: "tileTandem",
    href: "/partner/orders?tab=visits",
    roles: ["admin", "service_lead", "management"],
  },
  {
    id: "entwuerfe",
    zone: "vor",
    labelKey: "tileDraftDevices",
    href: "/partner/customers?filter=live",
    roles: ["admin", "service_lead"],
  },
  {
    id: "meineAuftraege",
    zone: "ent",
    labelKey: "tileMyOrdersWeek",
    href: "/partner/my-sites",
    roles: ["admin", "inspector"],
  },
  {
    id: "meineNachweise",
    zone: "ent",
    labelKey: "tileMyCredentials",
    href: "/partner/staff?expiring=1",
    roles: ["admin", "inspector"],
  },
  {
    id: "meineRueckfluss",
    zone: "ent",
    labelKey: "tileMyReturnFlow",
    href: "/partner/orders?tab=disposition&focus=return",
    roles: ["admin", "inspector"],
  },
  {
    id: "kunden",
    zone: "beob",
    labelKey: "tileCustomersLive",
    href: "/partner/customers?filter=live",
    roles: ["admin", "management", "service_lead", "order"],
  },
  {
    id: "geraete",
    zone: "beob",
    labelKey: "tileDevicesManaged",
    href: "/partner/customers?filter=live",
    roles: ["admin", "management", "service_lead"],
  },
  {
    id: "fremd",
    zone: "beob",
    labelKey: "tileExternalsReady",
    href: "/partner/external-inspectors?ready=1",
    roles: ["admin", "management", "service_lead"],
  },
  {
    id: "pipeline",
    zone: "beob",
    labelKey: "tilePipeline",
    href: "/partner/customers?filter=setup",
    roles: ["admin", "management"],
  },
];

function isKnownRole(role: PartnerAppRole | string): role is PartnerAppRole {
  return (KNOWN_PARTNER_APP_ROLES as readonly string[]).includes(role);
}

export function consoleNavPresetFor(role: PartnerAppRole | string) {
  if (isKnownRole(role)) return CONSOLE_NAV_PRESETS[role];
  return CONSOLE_NAV_PRESETS.inspector;
}

export function todayTilesForRole(role: PartnerAppRole | string): PartnerTileDef[] {
  const r = isKnownRole(role) ? role : "inspector";
  if (r === "admin") return [...PARTNER_TODAY_TILE_CATALOG];
  return PARTNER_TODAY_TILE_CATALOG.filter((t) => t.roles.includes(r));
}
