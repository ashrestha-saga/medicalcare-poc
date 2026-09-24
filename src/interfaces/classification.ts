export type ClassificationConfidence = "verified" | "derived" | "guess";
export type SoftwareClass = "IIb" | "III" | "C" | "D";

/** Legacy flags shape still used for inventory display tags. */
export interface ClassificationProposalDTO {
  annex1: boolean | null;
  annex2: boolean | null;
  softwareClass: SoftwareClass | null;
  radiation: boolean | null;
  confidence: ClassificationConfidence;
  source: string;
  ruleId?: string;
}

/** Historical JSON on ServiceRequest rows — no longer written on create. */
export interface ClassificationSubmissionDTO {
  proposed: ClassificationProposalDTO | null;
  selected: number[];
  confirmed: boolean;
  overridden: boolean;
}
