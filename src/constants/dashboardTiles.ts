import type { UserRole } from "@/interfaces/session";

/** Mockup KACHELART — Übersicht tiles leave work zones. */
export type DashboardTileKind = "arbeit" | "gemischt" | "eigen" | "uebersicht";

export const DASHBOARD_TILE_KIND: Record<string, DashboardTileKind> = {
  "abnahme-offen": "arbeit",
  "aerztliche-stelle": "arbeit",
  auditfaehigkeit: "gemischt",
  "aufb-extern": "arbeit",
  "auftraege-termin": "eigen",
  "befaehigung-auslaufend": "arbeit",
  "befund-frist": "arbeit",
  "befund-nachweis": "arbeit",
  "begehung-vorbereitung": "arbeit",
  "bestand-zustand": "uebersicht",
  bestandsverzeichnis: "arbeit",
  "betreuung-zugriffe": "uebersicht",
  bezugswerte: "arbeit",
  "buch-stoerungen": "uebersicht",
  "charge-offen": "arbeit",
  "dguv-faellig": "arbeit",
  "dguv-ohne-festlegung": "arbeit",
  "faellig-30": "arbeit",
  "freigabe-blockiert": "arbeit",
  "fristen-ohne-beleg": "uebersicht",
  "gesperrte-geraete": "arbeit",
  "implantat-doku": "arbeit",
  klaerliste: "arbeit",
  "konstanz-heute": "gemischt",
  "konstanz-takt-offen": "uebersicht",
  "kopplung-historie": "arbeit",
  "meine-einweisungen": "eigen",
  "meine-geraete": "eigen",
  "modelle-ohne-einstufung": "uebersicht",
  "mpsb-bestellung": "uebersicht",
  "mpsb-fehlt": "arbeit",
  "offene-punkte-standort": "arbeit",
  "pruefungen-quartal": "arbeit",
  "routine-heute": "arbeit",
  "rueckruf-abgleich": "arbeit",
  "rueckruf-offen": "arbeit",
  "sachkunde-aufb": "arbeit",
  sterilgut: "gemischt",
  "stoerung-melden": "arbeit",
  "sv-zulassung": "arbeit",
  "traegerschaft-luecke": "arbeit",
  ueberfaellig: "arbeit",
  "validierung-geraete": "arbeit",
  "vorkommnis-unbewertet": "arbeit",
  "vorkommnis-ungemeldet": "arbeit",
  "wasser-chemie": "gemischt",
};

export function tileKind(key: string): DashboardTileKind {
  return DASHBOARD_TILE_KIND[key] ?? "arbeit";
}

export function isOverviewTile(key: string): boolean {
  return tileKind(key) === "uebersicht";
}

/** Mockup ROLLEN labels for the dashboard. */
export const DASHBOARD_ROLE_LABELS: Record<UserRole, string> = {
  device_admin: "Gerätebeauftragte(r)",
  security_officer: "Sicherheitsbeauftragte(r)",
  user: "Anwenderin am Gerät",
  superadmin: "Verwaltung und Leitung",
};

export const DASHBOARD_ZONE_TITLES = {
  decides: "Entscheidet den Tag",
  worklist: "Arbeitsvorrat",
  watch: "Beobachtung",
} as const;
