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
  /** E70 — K-REP step input kind (check/text/select/parts/…). */
  inputKind?: string | null;
  optionsJson?: unknown;
  valueJson?: unknown;
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
  /** E90 — Prüfplakette required on pass for this inspection type. */
  requiresLabel: boolean;
  occasions: string[];
  appliedPartCode: string | null;
  appliedPartLabel: string | null;
  deviceFamilyCode: string | null;
  steps: InspectionStepResultDTO[];
  missingBaseline: boolean;
}

export interface CollectivePreviewItemDTO {
  id: string;
  position: number;
  status: string;
  deviceInstanceId: string;
  inventoryNumber: string;
  kind: string | null;
  deviceLabel: string;
  inspectionRunId: string | null;
  skippedReason: string | null;
}

export interface CataloguePreviewDTO {
  reference: string;
  /** ServiceRequest.id for partner repair APIs (parts proposal, etc.). */
  serviceRequestId: string;
  tenantId: string;
  /** instance | group (RD26). */
  subjectType: string;
  /** Null on group list view until a device is selected. */
  deviceInstanceId: string | null;
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
  /** Set when the site visit was ended (mockup endedAt). */
  visitCompletedAt: string | null;
  /** E34 — 1 = first visit of the day, 2+ = second visit. */
  visitSequence: number | null;
  /** Computed setup minutes when the visit was ended. */
  setupMinutes: number | null;
  /** E34 — reason text when sequence > 1. */
  secondVisitReason: string | null;
  overdue: boolean;
  serviceType: string;
  /** E77 — on_site | send_in */
  fulfilment: string;
  dueAt: string | null;
  inspectionTypeCode: string;
  sealed: boolean;
  /** E90 — suggested Prüfplakette when catalogue.requiresLabel (auto next-due + next sequence). */
  suggestedLabel: { number: string; nextDue: string } | null;
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
  /** RD26 — present when subjectType=group. */
  collective?: {
    done: number;
    total: number;
    items: CollectivePreviewItemDTO[];
  } | null;
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
  /** Wall-clock when the inspector started this protocol. */
  startedAt: string | null;
  /** Wall-clock when the protocol was sealed. */
  completedAt: string | null;
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

export type TestEquipmentStatus = "ok" | "due" | "lapsed" | "inactive";

export interface TestEquipmentDTO {
  id: string;
  classCode: string;
  classLabel: string | null;
  label: string;
  serialNumber: string | null;
  calibratedUntil: string | null;
  traceabilityRef: string | null;
  active: boolean;
  assignedMembershipId: string | null;
  assigneeName: string | null;
  status: TestEquipmentStatus;
}

export interface TestEquipmentClassDTO {
  code: string;
  label: string;
  group: "electrical" | "vitals" | "imaging" | "specialty" | "general";
}

export interface TestEquipmentAssigneeOptionDTO {
  membershipId: string;
  name: string;
  appRole: string;
}

export interface TestEquipmentListDTO {
  items: TestEquipmentDTO[];
  classes: TestEquipmentClassDTO[];
  assignees: TestEquipmentAssigneeOptionDTO[];
  summary: {
    total: number;
    active: number;
    due: number;
    lapsed: number;
    inactive: number;
  };
  canManage: boolean;
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
    /** Free-text / select / parts note for K-REP inputKind steps. */
    note?: string | null;
    valueJson?: unknown;
    /** P3 — possible patient relevance → partner_hint clarification. */
    mpsbHint?: boolean;
    mpsbText?: string | null;
  }
>;
