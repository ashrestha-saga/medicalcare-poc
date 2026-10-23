import type { MenuModuleId } from "@/interfaces/permissions";

/** Stable mockup keys for GET /api/nav/counts. */
export type NavCountKey =
  | "dash"
  | "list"
  | "faelligkeiten"
  | "auftraege"
  | "aufbnachweis"
  | "konstanztakt"
  | "schulungen"
  | "vorkommnisse"
  | "rueckrufe"
  | "begehung"
  | "models"
  | "traegerschaft"
  | "personen"
  | "sites"
  | "betreuung";

export type NavCountEntry = {
  count: number | null;
  warn: boolean;
  mark?: "!";
  mode?: "overdue" | "due";
};

export type NavCountsResponse = Partial<Record<NavCountKey, NavCountEntry>>;

/** Menu module id → count key (sidebar badge binding). */
export const MENU_ID_TO_NAV_COUNT: Partial<Record<MenuModuleId, NavCountKey>> = {
  dashboard: "dash",
  inventory: "list",
  "due-dates": "faelligkeiten",
  requests: "auftraege",
  reprocessing: "aufbnachweis",
  "constancy-cadence": "konstanztakt",
  training: "schulungen",
  incidents: "vorkommnisse",
  "field-safety": "rueckrufe",
  authority: "begehung",
  catalog: "models",
  users: "personen",
  locations: "sites",
  management: "betreuung",
};
