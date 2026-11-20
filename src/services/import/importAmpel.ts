import type { AmpelResult, NormalizedRow } from "./types";

/**
 * § 14 Ampel (mockup v26.4):
 * Rot = neither serial nor inventory number nor lot (Loskennung)
 * Gelb = identifier present but ≥1 Pflicht missing
 * Grün = Bezeichnung + (SN oder Loskennung) + Jahr + Hersteller + Standort
 *
 * Inventarnummer alone is enough to avoid Rot, but not enough for Grün
 * (SN/Los still required for the green path).
 */
export function ampel(r: Pick<
  NormalizedRow,
  | "seriennummer"
  | "inventarnummer"
  | "loskennung"
  | "bezeichnung"
  | "jahr"
  | "hersteller"
  | "standort"
  | "siteId"
  | "newSiteName"
>): AmpelResult {
  const fehlt: string[] = [];
  const hasSnOrLot = Boolean(r.seriennummer || r.loskennung);
  if (!hasSnOrLot && !r.inventarnummer) {
    return { stufe: "rot", fehlt: ["ohne Gerätekennung"] };
  }
  if (!r.bezeichnung) fehlt.push("Bezeichnung fehlt");
  if (!hasSnOrLot) fehlt.push("Seriennummer fehlt");
  if (!r.jahr) fehlt.push("Anschaffungsjahr fehlt");
  if (!r.hersteller) fehlt.push("Hersteller fehlt");
  const hasSite = Boolean(r.standort || r.siteId || r.newSiteName);
  if (!hasSite) fehlt.push("Standort fehlt");
  return { stufe: fehlt.length ? "gelb" : "gruen", fehlt };
}
