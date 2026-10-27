/** Static dossier section catalogue (v26.1 DOSSIER_SECTIONS). */

export const DOSSIER_SECTION_KEYS = [
  "deckblatt",
  "bestandsverzeichnis",
  "medizinproduktebuch",
  "nachweise",
  "einweisungen",
  "pruefungen",
  "aufbereitung",
  "meldewesen",
  "hygiene",
  "arbeitsschutz",
  "strahlenschutz",
] as const;

export type DossierSectionKey = (typeof DOSSIER_SECTION_KEYS)[number];

export const DOSSIER_SECTIONS: Record<
  DossierSectionKey,
  { labelDe: string; labelEn: string; printOrder: number }
> = {
  deckblatt: { labelDe: "Deckblatt", labelEn: "Cover", printOrder: 1 },
  bestandsverzeichnis: {
    labelDe: "Bestandsverzeichnis",
    labelEn: "Inventory",
    printOrder: 2,
  },
  medizinproduktebuch: {
    labelDe: "Medizinproduktebuch",
    labelEn: "Device book",
    printOrder: 3,
  },
  nachweise: { labelDe: "Nachweise", labelEn: "Evidence", printOrder: 4 },
  einweisungen: { labelDe: "Einweisungen", labelEn: "Instruction", printOrder: 5 },
  pruefungen: { labelDe: "Prüfungen je Gerät", labelEn: "Inspections", printOrder: 6 },
  aufbereitung: { labelDe: "Aufbereitung", labelEn: "Reprocessing", printOrder: 7 },
  meldewesen: { labelDe: "Meldewesen", labelEn: "Reporting", printOrder: 8 },
  hygiene: { labelDe: "Hygiene", labelEn: "Hygiene", printOrder: 9 },
  arbeitsschutz: {
    labelDe: "Arbeitsschutz",
    labelEn: "Occupational safety",
    printOrder: 10,
  },
  strahlenschutz: {
    labelDe: "Strahlenschutz",
    labelEn: "Radiation protection",
    printOrder: 11,
  },
};

export function isDossierSectionKey(value: string | null | undefined): value is DossierSectionKey {
  return Boolean(value && (DOSSIER_SECTION_KEYS as readonly string[]).includes(value));
}

export function dossierSectionLabel(key: string, locale: "de" | "en" = "en"): string {
  if (!isDossierSectionKey(key)) return key;
  return locale === "de" ? DOSSIER_SECTIONS[key].labelDe : DOSSIER_SECTIONS[key].labelEn;
}
