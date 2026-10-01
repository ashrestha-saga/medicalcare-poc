/**
 * C4 — split model-owned vs instance-owned Merkmale for classification reuse.
 */
import type { RegistrationCharacteristics } from "./types";

/** Model-level characteristics reused across inventarized units of the same model. */
export const MODEL_OWNED_FIELDS = [
  "produktart",
  "aktiv",
  "anlage1",
  "anlage2Ziffer",
  "anlage2ItemId",
  "anlage2Verfahren",
  "messgroesse",
  "messvariante",
  "strahlung",
  "strahlenArt",
  "zulassung",
  "konstanz",
  "software",
  "swKlasse",
  "wartungIntervall",
  "wartungQuelle",
  "wartungBegruendung",
  "wartungExtern",
  "energie",
  "vernetzt",
  "implantat",
  "istAufbGeraet",
  "eigenTyp",
  "einmalprodukt",
] as const;

/** Instance-owned — stay on DeviceInstance / characteristicsJson. */
export const INSTANCE_OWNED_FIELDS = [
  "aedAusnahme",
  "altgeraet",
  "aufbereitung",
  "aufbKlasse",
  "aufbGeraete",
  "aufbExtern",
  "zubehoer",
  "weitere",
] as const;

export type ModelOwnedField = (typeof MODEL_OWNED_FIELDS)[number];

export function extractModelCharacteristics(
  m: RegistrationCharacteristics,
): Partial<RegistrationCharacteristics> {
  const src = m as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of MODEL_OWNED_FIELDS) {
    if (key in src && src[key] !== undefined) {
      out[key] = src[key];
    }
  }
  return out as Partial<RegistrationCharacteristics>;
}

export function mergeModelPrefill(
  existing: RegistrationCharacteristics,
  modelChars: Partial<RegistrationCharacteristics> | null | undefined,
): RegistrationCharacteristics {
  if (!modelChars) return existing;
  return { ...existing, ...modelChars, produktart: modelChars.produktart || existing.produktart };
}

export function parseJsonObject<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
