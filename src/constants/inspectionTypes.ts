/**
 * FA-404 / AC #6 — the master list of inspection/service types.
 * This list is ALWAYS rendered in full. A classification proposal may highlight
 * or pre-select entries but must never remove or reorder them.
 */
export const INSPECTION_TYPES = [
  {
    code: "STK",
    label: "STK — Safety inspection",
    description: "Sicherheitstechnische Kontrolle (MPBetreibV Annex 1)",
    proposalKey: "annex1",
  },
  {
    code: "MTK",
    label: "MTK — Metrological inspection",
    description: "Messtechnische Kontrolle (MPBetreibV Annex 2)",
    proposalKey: "annex2",
  },
  {
    code: "DGUV",
    label: "DGUV V3 — Electrical safety test",
    description: "Electrical equipment test per DGUV Regulation 3",
    proposalKey: null,
  },
  {
    code: "REPAIR",
    label: "Repair / fault",
    description: "Device is faulty or damaged",
    proposalKey: null,
  },
  {
    code: "SOFTWARE",
    label: "Software / update",
    description: "Software-related service (class IIb/III/C/D software)",
    proposalKey: "softwareClass",
  },
  {
    code: "RADIATION",
    label: "Radiation protection check",
    description: "Constancy test for radiation-emitting devices",
    proposalKey: "radiation",
  },
  {
    code: "OTHER",
    label: "Other",
    description: "Anything not covered above — describe in the note",
    proposalKey: null,
  },
] as const;

export type InspectionTypeCode = (typeof INSPECTION_TYPES)[number]["code"];

export const INSPECTION_TYPE_CODES = INSPECTION_TYPES.map((t) => t.code) as InspectionTypeCode[];

export const PRIORITIES = ["low", "normal", "high", "critical"] as const;
export type Priority = (typeof PRIORITIES)[number];
