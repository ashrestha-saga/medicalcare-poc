/** Clarification / Klärliste — inventory data-quality issues. */

export type ClarificationIssueCode =
  | "missing_responsible"
  | "missing_maintenance_cycle"
  | "missing_classification"
  | "derived_classification"
  | "missing_room"
  | "missing_model_name"
  | "missing_serial"
  | "duplicate_serial";

/** Visual severity for list accent colors. */
export type ClarificationSeverity = "high" | "medium" | "low";

export interface ClarificationIssue {
  code: ClarificationIssueCode;
  label: string;
  severity: ClarificationSeverity;
}

export interface ClarificationItemDTO {
  deviceId: string;
  inventoryNumber: string;
  title: string;
  locationText: string | null;
  serialNumber: string | null;
  modelId: string | null;
  issues: ClarificationIssue[];
  /** Highest severity among issues. */
  severity: ClarificationSeverity;
  /** Joined human-readable reasons. */
  reasonText: string;
  createdAt: string;
  updatedAt: string;
  sourceLabel: string | null;
}

export interface ClarificationSummaryDTO {
  openCases: number;
  duplicates: number;
  derivedClassification: number;
  missingResponsible: number;
}

export interface ClarificationsResponse {
  summary: ClarificationSummaryDTO;
  items: ClarificationItemDTO[];
}
