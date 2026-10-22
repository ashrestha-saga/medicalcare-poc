import type { RegistrationCharacteristics } from "./types";

export type ManometerTyp = "quecksilber" | "aneroid" | "other";

/**
 * § 3 Abs. 4 MPBetreibV — Buchpflicht exceptions (Antragsweg in practice):
 * electronic compact fever thermometers; non-invasive BP with mercury or aneroid manometer.
 * MTK can still apply; this only affects Medizinproduktebuch membership / mpb prerequisite.
 */
export function isMpbetreibV34BookException(m: RegistrationCharacteristics): boolean {
  if (m.kompaktThermometer === true) return true;
  const typ = m.manometerTyp;
  return typ === "quecksilber" || typ === "aneroid";
}

/** Parse Merkmale JSON blob; returns empty object on failure. */
export function parseCharacteristicsJson(
  raw: string | null | undefined,
): RegistrationCharacteristics {
  if (!raw?.trim()) return { produktart: "" };
  try {
    const parsed = JSON.parse(raw) as RegistrationCharacteristics;
    return parsed && typeof parsed === "object" ? parsed : { produktart: "" };
  } catch {
    return { produktart: "" };
  }
}
