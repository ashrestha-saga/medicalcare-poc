export type ClassificationConfidence = "verified" | "derived" | "guess";

export type SoftwareClass = "IIb" | "III" | "C" | "D";

/** FA-400 — a proposal is a suggestion for the user, never a legal determination. */
export interface ClassificationProposalDTO {
  annex1: boolean | null;
  annex2: boolean | null;
  softwareClass: SoftwareClass | null;
  radiation: boolean | null;
  confidence: ClassificationConfidence;
  source: string;
  /** Rule that produced the proposal — kept for traceability, not shown as authority. */
  ruleId?: string;
}

export type ClassificationMatchType = "basicUdiDi" | "emdn" | "gmdn" | "manufacturerModel";

export interface ClassificationRuleDTO {
  id: string;
  matchType: ClassificationMatchType;
  matchValue: string;
  annex1: boolean | null;
  annex2: boolean | null;
  softwareClass: SoftwareClass | null;
  radiation: boolean | null;
  confidence: ClassificationConfidence;
  source: string;
  validFrom: string | null;
  validTo: string | null;
}

/** What the client sends back with a service request — FA-402/404. */
export interface ClassificationSubmissionDTO {
  proposed: ClassificationProposalDTO | null;
  /** Indices into the master inspection-type list the user selected. */
  selected: number[];
  confirmed: boolean;
  overridden: boolean;
}
