import { z } from "zod";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const createBookEntrySchema = z.object({
  deviceInstanceId: z.string().min(1),
  kind: z.enum(["malfunction", "operating_error", "note"]),
  occurredAt: dateOnly,
  description: z.string().min(1),
  consequence: z.string().optional().nullable(),
  repeatCount: z.number().int().positive().optional().nullable(),
  incidentId: z.string().optional().nullable(),
  correctsEntryId: z.string().optional().nullable(),
});
export type CreateBookEntryInput = z.infer<typeof createBookEntrySchema>;

/** IFU / Gebrauchsanweisung upload from the medical device book. */
export const uploadDeviceBookIfuSchema = z
  .object({
    deviceInstanceId: z.string().min(1),
    dataUrl: z.string().optional().nullable(),
    externalRecordRef: z.string().optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (!val.dataUrl?.trim() && !val.externalRecordRef?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "File or external reference required",
        path: ["dataUrl"],
      });
    }
  });
export type UploadDeviceBookIfuInput = z.infer<typeof uploadDeviceBookIfuSchema>;

/** Scan-App Störung melden — three-valued harm/outOfService, no defaults. */
export const reportMalfunctionSchema = z.object({
  deviceInstanceId: z.string().min(1),
  kind: z.enum(["malfunction", "operating_error", "note"]),
  occurredAt: dateOnly,
  description: z.string().min(10),
  harm: z.enum(["yes", "no", "unknown"]),
  outOfService: z.enum(["yes", "no"]),
  consequence: z.string().optional().nullable(),
});
export type ReportMalfunctionInput = z.infer<typeof reportMalfunctionSchema>;

export const createIncidentSchema = z.object({
  deviceInstanceId: z.string().optional().nullable(),
  deviceModelId: z.string().optional().nullable(),
  occurredAt: dateOnly,
  noticedAt: dateOnly,
  description: z.string().min(1),
  harmDescription: z.string().optional().nullable(),
  measureTaken: z.string().optional().nullable(),
});
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;

export const assessIncidentSchema = z
  .object({
    /** null = looked at and still undecided (sets assessedAt). */
    suspectedSerious: z.boolean().nullable(),
    assessmentNote: z.string().optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.suspectedSerious === false && !val.assessmentNote?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Reason required when not suspected serious",
        path: ["assessmentNote"],
      });
    }
  });
export type AssessIncidentInput = z.infer<typeof assessIncidentSchema>;

export const reportIncidentSchema = z.object({
  reportedAt: dateOnly,
  reportReference: z.string().optional().nullable(),
  reportedTo: z.string().optional().nullable(),
  channel: z
    .enum(["authority_portal", "manufacturer_portal", "email", "post", "fax", "other"])
    .optional(),
  manufacturerNotifiedAt: dateOnly.optional().nullable(),
});
export type ReportIncidentInput = z.infer<typeof reportIncidentSchema>;

export const assignIncidentSchema = z.object({
  assignedUserId: z.string().min(1),
  dueAt: dateOnly.optional().nullable(),
});
export type AssignIncidentInput = z.infer<typeof assignIncidentSchema>;

export const createFieldSafetySchema = z.object({
  reference: z.string().min(1),
  manufacturer: z.string().min(1),
  title: z.string().min(1),
  requiredAction: z.string().min(1),
  issuedAt: dateOnly,
  receivedAt: dateOnly,
  dueAt: dateOnly.optional().nullable(),
  affectedScope: z.string().min(1),
  documentRef: z.string().optional().nullable(),
});
export type CreateFieldSafetyInput = z.infer<typeof createFieldSafetySchema>;

export const fieldSafetyAffectedModelSchema = z.object({
  deviceModelId: z.string().optional().nullable(),
  basicUdiDi: z.string().optional().nullable(),
  serialFrom: z.string().optional().nullable(),
  serialTo: z.string().optional().nullable(),
  lotNumber: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});
export type FieldSafetyAffectedModelInput = z.infer<typeof fieldSafetyAffectedModelSchema>;

export const createFieldSafetyWithDevicesSchema = createFieldSafetySchema.extend({
  /** Devices to enqueue for Abgleich (affected=null until decided). */
  deviceInstanceIds: z.array(z.string().min(1)).default([]),
  /** Structured scope — drives suggestCandidates. */
  affectedModels: z.array(fieldSafetyAffectedModelSchema).default([]),
});
export type CreateFieldSafetyWithDevicesInput = z.infer<typeof createFieldSafetyWithDevicesSchema>;

export const matchFieldSafetyDeviceSchema = z.object({
  deviceInstanceId: z.string().min(1),
  affected: z.boolean().nullable(),
  actionTakenAt: dateOnly.optional().nullable(),
  actionNote: z.string().optional().nullable(),
});
export type MatchFieldSafetyDeviceInput = z.infer<typeof matchFieldSafetyDeviceSchema>;

export const addFieldSafetyAffectedModelsSchema = z.object({
  affectedModels: z.array(fieldSafetyAffectedModelSchema).min(1),
});
export type AddFieldSafetyAffectedModelsInput = z.infer<typeof addFieldSafetyAffectedModelsSchema>;

export const createReprocessingCheckSchema = z.object({
  checkCode: z.string().min(1),
  equipmentDeviceId: z.string().optional().nullable(),
  siteId: z.string().optional().nullable(),
  batchId: z.string().optional().nullable(),
  performedAt: dateOnly,
  passed: z.boolean().optional().nullable(),
  measuredValue: z.string().optional().nullable(),
  withinLimit: z.boolean().optional().nullable(),
  note: z.string().optional().nullable(),
});
export type CreateReprocessingCheckInput = z.infer<typeof createReprocessingCheckSchema>;

export const submitScanRoutineSchema = z.object({
  answers: z
    .array(
      z.object({
        checkCode: z.string().min(1),
        passed: z.boolean().optional().nullable(),
        measuredValue: z.string().optional().nullable(),
      }),
    )
    .min(1),
  note: z.string().optional().nullable(),
});
export type SubmitScanRoutineInput = z.infer<typeof submitScanRoutineSchema>;

export const createReprocessingBatchSchema = z.object({
  equipmentDeviceId: z.string().min(1),
  batchNumber: z.string().min(1),
  programme: z.string().optional().nullable(),
  startedAt: z.string().min(1),
  finishedAt: z.string().optional().nullable(),
  loadPattern: z.string().optional().nullable(),
  processRecordRef: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        deviceInstanceId: z.string().optional().nullable(),
        label: z.string().optional().nullable(),
        quantity: z.number().int().positive().default(1),
      }),
    )
    .default([]),
});
export type CreateReprocessingBatchInput = z.infer<typeof createReprocessingBatchSchema>;

export const releaseBatchSchema = z.object({
  releaseResult: z.enum(["released", "released_with_conditions", "rejected"]),
  releaseNote: z.string().optional().nullable(),
});
export type ReleaseBatchInput = z.infer<typeof releaseBatchSchema>;

/** Scan-App: create charge with finished run + at least one load item. */
export const createScanChargeSchema = z.object({
  equipmentDeviceId: z.string().min(1),
  batchNumber: z.string().min(1).max(64),
  programme: z.string().min(1).max(120),
  startedAt: z.string().min(1),
  finishedAt: z.string().min(1),
  loadPattern: z.string().max(200).optional().nullable(),
  items: z
    .array(
      z.object({
        label: z.string().min(1).max(200),
        quantity: z.number().int().positive().default(1),
      }),
    )
    .min(1),
});
export type CreateScanChargeInput = z.infer<typeof createScanChargeSchema>;

export const attachScanChargeBelegSchema = z.object({
  dataUrl: z.string().min(20),
  /** Client-computed SHA-256 hex of file bytes; server re-hashes and compares. */
  sha256: z
    .string()
    .regex(/^[a-fA-F0-9]{64}$/)
    .optional()
    .nullable(),
});
export type AttachScanChargeBelegInput = z.infer<typeof attachScanChargeBelegSchema>;

export const releaseScanChargeSchema = z.object({
  releaseResult: z.enum(["released", "released_with_conditions", "rejected"]),
  releaseNote: z.string().optional().nullable(),
  /** Signature intent (PIN/WebAuthn later). */
  confirmSign: z.literal(true),
  answers: z
    .array(
      z.object({
        checkCode: z.string().min(1),
        passed: z.boolean().optional().nullable(),
        measuredValue: z.string().optional().nullable(),
      }),
    )
    .optional()
    .default([]),
});
export type ReleaseScanChargeInput = z.infer<typeof releaseScanChargeSchema>;

export const createConstancyCadenceSchema = z.object({
  deviceInstanceId: z.string().min(1),
  constancyObjectCode: z.string().min(1),
  intervalValue: z.number().int().positive(),
  intervalUnit: z.enum(["months", "years"]),
  basisText: z.string().min(1),
  determinedAt: dateOnly,
});
export type CreateConstancyCadenceInput = z.infer<typeof createConstancyCadenceSchema>;

/** Scan-App Konstanzprüfung — pass / conditions / fail on one open duty. */
export const submitScanKonstanzSchema = z.object({
  dutyId: z.string().min(1),
  result: z.enum(["passed", "passed_with_conditions", "failed"]),
  note: z.string().optional().nullable(),
  performedAt: dateOnly.optional().nullable(),
});
export type SubmitScanKonstanzInput = z.infer<typeof submitScanKonstanzSchema>;

export const createDutyOverlapSchema = z.object({
  deviceInstanceId: z.string().min(1),
  coveredDutyKey: z.enum(["dguv", "stk"]),
  satisfiedByDutyKey: z.enum(["dguv", "stk"]),
  reasonText: z.string().min(1),
  decidedAt: dateOnly,
});
export type CreateDutyOverlapInput = z.infer<typeof createDutyOverlapSchema>;

export const createAuthorityInspectionSchema = z.object({
  siteId: z.string().optional().nullable(),
  authorityKind: z.enum([
    "health_office",
    "device_authority",
    "occupational_safety",
    "metrology",
    "medical_board",
    "other",
  ]),
  authorityName: z.string().min(1),
  legalBasis: z.string().optional().nullable(),
  announcedAt: dateOnly.optional().nullable(),
  visitedAt: dateOnly,
  protocolReceivedAt: dateOnly.optional().nullable(),
  protocolRef: z.string().optional().nullable(),
  feeEur: z.number().optional().nullable(),
  checklistCode: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});
export type CreateAuthorityInspectionInput = z.infer<typeof createAuthorityInspectionSchema>;

export const createAuthorityFindingSchema = z.object({
  itemNo: z.string().optional().nullable(),
  description: z.string().min(1),
  legalBasis: z.string().optional().nullable(),
  dueAt: dateOnly.optional().nullable(),
  deviceInstanceId: z.string().optional().nullable(),
});
export type CreateAuthorityFindingInput = z.infer<typeof createAuthorityFindingSchema>;

export const remediateFindingSchema = z.object({
  remediationNote: z.string().min(1),
  remediatedAt: dateOnly,
  evidenceBlobId: z.string().optional().nullable(),
  /** When set, creates AuthorityNotification (finding_remediation). */
  notifyRecipient: z.string().optional().nullable(),
});
export type RemediateFindingInput = z.infer<typeof remediateFindingSchema>;

export const openDisclosureSchema = z.object({
  expiresAt: z.string().min(1),
  audience: z.string().min(1),
  purpose: z.string().optional().nullable(),
  scope: z.array(z.string()).min(1),
});
export type OpenDisclosureInput = z.infer<typeof openDisclosureSchema>;

export const setRoleDashboardTilesSchema = z.object({
  role: z.enum(["superadmin", "device_admin", "security_officer", "user"]),
  tileKeys: z.array(z.string()),
});
export type SetRoleDashboardTilesInput = z.infer<typeof setRoleDashboardTilesSchema>;
