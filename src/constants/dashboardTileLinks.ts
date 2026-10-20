/**
 * Sprint A — dashboard tile → destination with query filters.
 * Count predicates in dashboardBoardService should stay aligned with these params.
 */

export type DashboardTileLink = {
  path: string;
  query?: Record<string, string>;
};

export const DASHBOARD_TILE_LINKS: Record<string, DashboardTileLink> = {
  ueberfaellig: { path: "/due-dates", query: { filter: "overdue" } },
  "faellig-30": { path: "/due-dates", query: { horizon: "30" } },
  "fristen-ohne-beleg": { path: "/due-dates" },
  "pruefungen-quartal": { path: "/due-dates", query: { horizon: "90" } },
  "konstanz-heute": { path: "/due-dates", query: { dutyKey: "konstanz", scheduled: "1" } },
  "dguv-faellig": { path: "/due-dates", query: { dutyKey: "dguv", horizon: "30" } },
  "implantat-doku": { path: "/due-dates", query: { dutyKey: "implantat" } },
  "aufb-extern": { path: "/due-dates", query: { dutyKey: "kontrolle" } },
  bezugswerte: { path: "/due-dates", query: { dutyKey: "konstanz" } },
  "abnahme-offen": { path: "/due-dates", query: { dutyKey: "abnahme" } },
  "aerztliche-stelle": { path: "/due-dates", query: { dutyKey: "aerztl" } },
  "sv-zulassung": { path: "/due-dates", query: { dutyKey: "sv" } },
  "validierung-geraete": { path: "/due-dates", query: { dutyKey: "validierung" } },

  "freigabe-blockiert": { path: "/devices", query: { state: "draft" } },
  "bestand-zustand": { path: "/devices" },
  bestandsverzeichnis: { path: "/devices", query: { state: "released" } },
  "meine-geraete": { path: "/devices", query: { mineArea: "1" } },
  "gesperrte-geraete": { path: "/devices", query: { state: "not_released", mineArea: "1" } },
  "kopplung-historie": { path: "/devices" },
  auditfaehigkeit: { path: "/devices", query: { state: "released" } },

  klaerliste: { path: "/clarifications" },
  "offene-punkte-standort": { path: "/clarifications" },

  "vorkommnis-unbewertet": { path: "/incidents", query: { view: "unassessed" } },
  "vorkommnis-ungemeldet": { path: "/incidents", query: { view: "unreported" } },

  "rueckruf-offen": { path: "/field-safety", query: { view: "open" } },
  "rueckruf-abgleich": { path: "/field-safety", query: { view: "unmatched" } },

  "buch-stoerungen": { path: "/device-book" },

  "auftraege-termin": { path: "/requests", query: { state: "scheduled" } },
  "stoerung-melden": { path: "/requests", query: { scope: "mine" } },

  "routine-heute": {
    path: "/reprocessing",
    query: { section: "checks", cadence: "daily", openToday: "1" },
  },
  "charge-offen": { path: "/reprocessing", query: { section: "batches" } },
  "wasser-chemie": {
    path: "/reprocessing",
    query: { section: "checks", cadence: "daily", openToday: "1", scope: "water,chemistry" },
  },
  sterilgut: {
    path: "/reprocessing",
    query: {
      section: "checks",
      cadence: "daily",
      openToday: "1",
      scope: "sterile_storage",
    },
  },

  "konstanz-takt-offen": { path: "/constancy-cadence", query: { section: "missing" } },
  "dguv-ohne-festlegung": { path: "/duty-overlap" },

  "befund-frist": {
    path: "/authority",
    query: { section: "findings", status: "open", hasDue: "1" },
  },
  "befund-nachweis": {
    path: "/authority",
    query: { section: "findings", status: "remediated" },
  },
  "begehung-vorbereitung": {
    path: "/authority",
    query: { mode: "vorbereitung", tab: "luecken" },
  },

  "modelle-ohne-einstufung": { path: "/catalog" },
  "mpsb-bestellung": { path: "/locations" },
  "mpsb-fehlt": { path: "/locations", query: { mpsb: "missing" } },
  "meine-einweisungen": { path: "/training", query: { mine: "1" } },
  "befaehigung-auslaufend": { path: "/training", query: { expiring: "365" } },
  "sachkunde-aufb": { path: "/users" },
  "betreuung-zugriffe": { path: "/activity", query: { actorKind: "partner" } },
  "traegerschaft-luecke": { path: "/dashboard/assignments" },
};

export function hrefForDashboardTile(key: string): string | null {
  const link = DASHBOARD_TILE_LINKS[key];
  if (!link) return null;
  if (!link.query || Object.keys(link.query).length === 0) return link.path;
  const qs = new URLSearchParams(link.query).toString();
  return `${link.path}?${qs}`;
}
