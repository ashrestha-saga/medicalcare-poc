import type { Confidence, DutyKey, IntervalUnit } from "@prisma/client";

/**
 * Map deriveDuties / mockup duty ids onto persisted DutyKey enum values.
 * Dynamic suffixes (val-ref-*, zub-*, konstanz-*) collapse to the canonical key.
 */
export function canonicalDutyKey(id: string): DutyKey {
  if (id.startsWith("val-ref-") || id.startsWith("valref-") || id === "validierung-verweis") {
    return "validierung_verweis";
  }
  if (id.startsWith("zub-") || id === "zubehoer") return "zubehoer";
  if (id.startsWith("konstanz-")) return "konstanz";

  const stem = id.split("-")[0] ?? id;
  const map: Record<string, DutyKey> = {
    wartung: "wartung",
    stk: "stk",
    mtk: "mtk",
    abnahme: "abnahme",
    konstanz: "konstanz",
    sv: "sv",
    aerztl: "aerztl",
    nuklear: "nuklear",
    itsec: "itsec",
    install: "install",
    aufb: "aufbereitung",
    aufbereitung: "aufbereitung",
    kontrolle: "kontrolle",
    "aufb-extern": "kontrolle",
    "eigen-val": "validierung",
    validierung: "validierung",
    einmal: "einmalprodukt",
    einmalprodukt: "einmalprodukt",
    zub: "zubehoer",
    netz: "vernetzung",
    vernetzung: "vernetzung",
    impl: "implantat",
    implantat: "implantat",
  };
  return map[id] ?? map[stem] ?? "wartung";
}

export function toIntervalUnit(einheit: string | null | undefined): IntervalUnit | null {
  if (!einheit) return null;
  const lower = einheit.toLowerCase();
  if (lower === "monate" || lower === "months" || lower === "month" || lower === "monat") {
    return "months";
  }
  if (lower === "jahre" || lower === "years" || lower === "year" || lower === "jahr") {
    return "years";
  }
  return null;
}

/** Prefer `derived` wherever legacy `guess` still appears. */
export function normalizeConfidence(value: string | null | undefined): Confidence | null {
  if (!value) return null;
  if (value === "guess") return "derived";
  if (
    value === "verified" ||
    value === "responsible" ||
    value === "determination" ||
    value === "derived" ||
    value === "not_applicable"
  ) {
    return value;
  }
  return "derived";
}
