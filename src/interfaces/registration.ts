import type { ProductKindDTO } from "@/services/registration/productKindTypes";
import type {
  DerivedDuty,
  PrerequisiteItem,
  RegistrationCharacteristics,
} from "@/services/registration/types";
import type {
  DecisionProtocolEntry,
  FieldAnswerMeta,
} from "@/services/registration/answerMeta";
import type { CheckRuleHit } from "@/services/registration/checkRules";

export type {
  ProductKindDTO,
  DerivedDuty,
  PrerequisiteItem,
  RegistrationCharacteristics,
  DecisionProtocolEntry,
  FieldAnswerMeta,
  CheckRuleHit,
};

export const REGISTRATION_STEPS = ["Device", "Characteristics", "Duties", "Prerequisites"] as const;
export type RegistrationStepLabel = (typeof REGISTRATION_STEPS)[number];

/** Identity fields collected on wizard step 1 (client form strings). */
export interface RegistrationIdentityForm {
  tradeName: string;
  manufacturer: string;
  modelName: string;
  serialNumber: string;
  udiDi: string;
  inventoryNumber: string;
  purchaseYear: string;
  /** Display name — filled from selected user. */
  responsiblePerson: string;
  /** Required — device_admin user id. */
  responsibleUserId: string;
  siteId: string;
  areaId: string;
  room: string;
}

export interface RegistrationAnnex2Ref {
  id: string;
  itemNo: string;
  label: string;
  isGroup: boolean;
  intervalYears: number | null;
  conditionText: string | null;
  restriction: string | null;
  matchTerms: string[];
  matchExclude: string[];
  matchConfidence: string;
  hinweis: string | null;
  verfahren: string | null;
  wahlweiseNach: string[] | null;
  variante: string | null;
  quelle: string | null;
}

export interface RegistrationRefBundle {
  annex2: RegistrationAnnex2Ref[];
  constancy: { code: string; label: string; defaultCadence: string }[];
  reprocessing: {
    code: string;
    label: string;
    requiresQmsCert: boolean;
    requiresValidatedProcess?: boolean;
    evidence?: string | null;
    note: string | null;
  }[];
  equipment: {
    code: string;
    label: string;
    equipmentStandard: string;
    validationStandard: string;
    revalidationMonths: number;
    intervalDisputed: boolean;
    intervalSource: string;
    routineChecks: string[];
    releaseRule: string | null;
  }[];
  radiation: {
    code: string;
    label: string;
    defaultAuthorisation: string;
    medicalBoardNote: string | null;
    qualityGuideline?: string | null;
    expertInspectionApplies?: boolean;
  }[];
  zubehoerTemplates: { t: string; klasse: string }[];
}

export interface RegistrationDraftDTO {
  id: string;
  inventoryNumber: string;
  serialNumber: string | null;
  udiDi: string | null;
  productKindCode: string | null;
  characteristics: RegistrationCharacteristics;
  responsiblePerson: string | null;
  responsibleUserId: string | null;
  areaId: string | null;
  siteId: string | null;
  room: string | null;
  purchaseYear: number | null;
  model: { tradeName: string | null; manufacturer: string | null; modelName: string | null } | null;
  /** C4 — model-owned Merkmale from open classification. */
  modelClassificationPrefill?: RegistrationCharacteristics | null;
  modelClassificationConfidence?: string | null;
  modelClassificationFieldStates?: Record<string, string> | null;
  openClarifications?: {
    id: string;
    kind: string;
    field: string | null;
    prerequisiteCode: string | null;
    label: string;
    deferredBy: string;
    deferredAt: string;
  }[];
}

export interface RegistrationScreenProps {
  draftId?: string;
}

/** Model-wide reclassification (admin) — steps Characteristics → Duties → Prerequisites. */
export interface ReclassifyContextDTO {
  modelId: string;
  displayName: string;
  manufacturer: string | null;
  copyCount: number;
  siteCount: number;
  releasedCount: number;
  characteristics: RegistrationCharacteristics;
  sampleInventoryNumber: string | null;
}

export interface ReclassifyScreenProps {
  modelId: string;
}

export type DutyScheduleStatus = "ok" | "due" | "overdue" | "unset" | "n/a";

/** Frozen DeviceDuty row with a computed due date (when the anchor has one). */
export interface DeviceDutyDTO {
  id: string;
  deviceInstanceId: string;
  dutyKey: string;
  inspectionTypeCode: string;
  title: string;
  basisText: string;
  deadlineAnchor: string;
  intervalValue: number | null;
  intervalUnit: string | null;
  cadenceLabel: string | null;
  applicable: boolean;
  notApplicableReason: string | null;
  referenceDate: string;
  dueAt: string | null;
  lastCompletedAt: string | null;
  evidenceHint: string | null;
  confidence: string;
  status: DutyScheduleStatus;
  inventoryNumber?: string;
  tradeName?: string | null;
}
