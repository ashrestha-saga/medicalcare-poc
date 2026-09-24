export type TrainingInstructionStatus = "instructed" | "equivalent_series" | "open";

/** Derived display status for an event / its records. */
export type TrainingEventStatusKind = "no_expiry" | "valid" | "overdue";

export interface TrainingPersonDTO {
  id: string;
  name: string;
  jobTitle: string | null;
  employedTo: string | null;
  anonymised: boolean;
}

export interface TrainingRecordDTO {
  id: string;
  personId: string;
  personName: string;
  personJobTitle: string | null;
  confirmedAt: string;
  validUntil: string | null;
}

export interface TrainingEventDTO {
  id: string;
  trainingTypeCode: string;
  trainingTypeLabel: string;
  legalBasis: string;
  /** explanatory note from RefTrainingType (shown on detail). */
  trainingTypeNote: string | null;
  validityMonths: number | null;
  subjectModelId: string | null;
  subjectModelName: string | null;
  subjectActivity: string | null;
  heldOn: string;
  location: string | null;
  instructorName: string;
  instructorQualification: string;
  instructorExternal: boolean;
  basisDocument: string;
  mode: string;
  recordedBy: string;
  recordCount: number;
  records: TrainingRecordDTO[];
  /** Aggregated from type + records for the overview table. */
  statusKind: TrainingEventStatusKind;
  statusLabel: string;
}

export interface TrainingMatrixCellDTO {
  personId: string;
  personName: string;
  personJobTitle: string | null;
  modelId: string;
  modelName: string;
  productSeries: string | null;
  status: TrainingInstructionStatus;
}

export interface TrainingSummaryDTO {
  events: number;
  records: number;
  overdue: number;
  withoutRecord: number;
}

export interface TrainingTypeOptionDTO {
  code: string;
  label: string;
  legalBasis: string;
  subjectKind: "model" | "activity";
  validityMonths: number | null;
  note: string | null;
}

export interface TrainingModelOptionDTO {
  id: string;
  name: string;
}

/** Options for the Record training form (types, subjects, staff). */
export interface TrainingFormOptionsDTO {
  types: TrainingTypeOptionDTO[];
  models: TrainingModelOptionDTO[];
  activities: string[];
  staff: TrainingPersonDTO[];
}

export interface TrainingOverviewDTO {
  summary: TrainingSummaryDTO;
  events: TrainingEventDTO[];
  staff: TrainingPersonDTO[];
  matrix: TrainingMatrixCellDTO[];
  form: TrainingFormOptionsDTO;
}

export interface CreateTrainingEventResultDTO {
  event: TrainingEventDTO;
}
