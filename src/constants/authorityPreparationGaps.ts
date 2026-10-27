/**
 * Static gap catalogue keyed by dossier section (v26.1 PREPARATION_GAPS).
 * Queries are evaluated in begehPrepService / preparationService.
 */

export type PreparationGapCode =
  | "draft_devices"
  | "open_daily_checks"
  | "unreleased_batches"
  | "unassessed_incidents"
  | "unreported_incidents"
  | "missing_constancy_cadence"
  | "field_safety_unmatched";

export type PreparationGapDef = {
  code: PreparationGapCode;
  /** Deep link into the app that holds the open state. */
  target: string;
  /** Optional checklist position hint for CL-MP-DE (mockup LUECKE_ZIEL). */
  mpPositionHint?: number;
};

/** Gaps that land on a dossier section — and thus on checklist items mapping there. */
export const PREPARATION_GAPS: Record<string, PreparationGapDef[]> = {
  bestandsverzeichnis: [
    { code: "draft_devices", target: "/devices?state=draft", mpPositionHint: 1 },
  ],
  aufbereitung: [
    { code: "open_daily_checks", target: "/reprocessing?openToday=1", mpPositionHint: 16 },
    { code: "unreleased_batches", target: "/reprocessing?section=batches", mpPositionHint: 19 },
  ],
  meldewesen: [
    {
      code: "unassessed_incidents",
      target: "/incidents?view=unassessed",
      mpPositionHint: 22,
    },
    {
      code: "unreported_incidents",
      target: "/incidents?view=unreported",
      mpPositionHint: 22,
    },
  ],
};

/**
 * Gaps with no checklist item in typical MP lists — returned as `unmapped[]`
 * (“weitere offene Zustände”).
 */
export const UNMAPPED_PREPARATION_GAPS: PreparationGapDef[] = [
  {
    code: "missing_constancy_cadence",
    target: "/constancy-cadence?section=missing",
  },
  {
    code: "field_safety_unmatched",
    target: "/field-safety?view=unmatched",
  },
];
