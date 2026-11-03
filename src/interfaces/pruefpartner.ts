/** Resolved inspection step for Prüfpartner run UI. */
export interface InspectionStepResultDTO {
  stepId: string;
  position: number;
  label: string;
  isMeasurement: boolean;
  unit: string | null;
  limitText: string | null;
  limitSource: string | null;
  comparedToBaseline: boolean;
  baselineValue: string | null;
  triggerNote: string | null;
  confirmed: boolean | null;
  measuredValue: string | null;
  withinLimit: boolean | null;
  baselineFlag: boolean;
  note: string | null;
  source: "catalogue" | "family";
  /** D11 — persisted no-photo reason for failed steps. */
  noPhotoReason?: string | null;
  /** D11 — count of Mangelbild attachments. */
  photoCount?: number;
  /** Result row id when a draft/sealed run exists (for photo upload). */
  resultId?: string | null;
}

export interface ResolvedCataloguePreviewDTO {
  catalogueId: string;
  code: string;
  label: string;
  inspectionTypeCode: string;
  scope: string;
  scopeValue: string | null;
  draft: boolean;
  noCatalogue: boolean;
  note: string | null;
  legalBasis: string | null;
  retention: string | null;
  testEquipmentClass: string | null;
  testEquipmentClassLabel: string | null;
  traceabilityRequired: boolean;
  setsBaseline: boolean;
  requiresBaseline: boolean;
  occasions: string[];
  appliedPartCode: string | null;
  appliedPartLabel: string | null;
  deviceFamilyCode: string | null;
  steps: InspectionStepResultDTO[];
  missingBaseline: boolean;
}

export interface CataloguePreviewDTO {
  reference: string;
  tenantId: string;
  deviceInstanceId: string;
  inventoryNumber: string;
  serialNumber: string | null;
  deviceLabel: string;
  modelName: string | null;
  manufacturer: string | null;
  locationText: string;
  accessHint: string | null;
  /** Clinic site (Standort) for day-plan grouping. */
  siteId: string | null;
  siteName: string | null;
  /** Disposition appointment — preferred for Heute/Woche buckets. */
  scheduledAt: string | null;
  visitId: string | null;
  visitStartedAt: string | null;
  overdue: boolean;
  serviceType: string;
  dueAt: string | null;
  inspectionTypeCode: string;
  sealed: boolean;
  catalogue: ResolvedCataloguePreviewDTO | null;
  qualificationGate: {
    ok: boolean;
    required: { code: string; label: string }[];
    missing: { code: string; label: string }[];
  };
  equipmentGate: {
    ok: boolean;
    requiredClass: string | null;
    blockedReason: string | null;
  };
  eligibleEquipment: {
    id: string;
    label: string;
    serialNumber: string | null;
    calibratedUntil: string | null;
    traceabilityRef: string | null;
  }[];
  draftRunId: string | null;
  /** Sealed protocol run id when assignment is already completed. */
  sealedRunId: string | null;
}

export interface InspectionRunDTO {
  id: string;
  reference: string;
  tenantId: string;
  deviceInstanceId: string;
  catalogueId: string;
  catalogueCode: string;
  catalogueLabel: string;
  draft: boolean;
  noCatalogue: boolean;
  deviceConfirmed: boolean;
  deviceConfirmSkipped: boolean;
  deviceConfirmCode: string | null;
  occasionCode: string | null;
  performedAt: string;
  performedByName: string;
  result: string;
  note: string | null;
  dutyPerformanceId: string | null;
  idempotencyKey: string | null;
  inventoryNumber: string;
  serialNumber: string | null;
  deviceLabel: string;
  testEquipmentId: string | null;
  steps: InspectionStepResultDTO[];
  sealed: boolean;
  /** D2 — linked ServiceVisit id (Phase 1 always set before seal). */
  visitId?: string | null;
  visitStartedAt?: string | null;
  /** D10 — seal signature summary. */
  signatures?: {
    kind: string;
    signerName: string | null;
    signerRole: string | null;
    signedAt: string | null;
    absent: boolean;
    absentReason: string | null;
  }[];
}

export interface TestEquipmentDTO {
  id: string;
  classCode: string;
  label: string;
  serialNumber: string | null;
  calibratedUntil: string | null;
  traceabilityRef: string | null;
  active: boolean;
}

export type InspectionResultCode = "passed" | "passed_with_conditions" | "failed";

/** Inspect-rail status for a follow-up proposal (Nachbesuch). */
export type InspectFollowUpStatus =
  | "waiting"
  | "assigned"
  | "scheduled"
  | "in_progress"
  | "done";

export interface InspectFollowUpRowDTO {
  reference: string;
  parentReference: string | null;
  tenantId: string;
  tenantName: string | null;
  deviceLabel: string;
  followUpNeeds: string | null;
  followUpUrgency: string | null;
  state: string;
  status: InspectFollowUpStatus;
  assigneeName: string | null;
  scheduledAt: string | null;
  createdAt: string;
}

export interface InspectFollowUpListDTO {
  rows: InspectFollowUpRowDTO[];
}

/** Client-side draft for step ratings before PATCH. */
export type InspectionStepDraft = Record<
  string,
  {
    confirmed?: boolean | null;
    measuredValue?: string | null;
    rating?: "ok" | "defect" | null;
    noPhotoReason?: string | null;
    /** Justification when rating OK despite outside limit. */
    limitOverrideReason?: string | null;
    /** P3 — possible patient relevance → partner_hint clarification. */
    mpsbHint?: boolean;
    mpsbText?: string | null;
  }
>;
