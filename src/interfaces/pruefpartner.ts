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

/** Client-side draft for step ratings before PATCH. */
export type InspectionStepDraft = Record<
  string,
  {
    confirmed?: boolean | null;
    measuredValue?: string | null;
    rating?: "ok" | "defect" | null;
  }
>;
