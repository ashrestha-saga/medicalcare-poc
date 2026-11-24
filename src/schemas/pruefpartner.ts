import { z } from "zod";

export const startInspectionRunSchema = z.object({
  reference: z.string().trim().min(1).max(100),
  /** Sammelauftrag item device (required when subjectType=group). */
  deviceInstanceId: z.string().trim().min(1).max(100).nullable().optional(),
  occasionCode: z.string().trim().min(1).max(50).nullable().optional(),
  testEquipmentId: z.string().trim().min(1).max(100).nullable().optional(),
  performedAt: z.string().trim().min(1).max(32).optional(),
});

export type StartInspectionRunInput = z.infer<typeof startInspectionRunSchema>;

export const confirmDeviceSchema = z
  .object({
    code: z.string().trim().max(200).optional(),
    skip: z.boolean().optional(),
  })
  .refine((v) => v.skip === true || Boolean(v.code?.trim()), {
    message: "Provide a scan code or skip.",
  });

export type ConfirmDeviceInput = z.infer<typeof confirmDeviceSchema>;

export const inspectionStepPatchSchema = z.object({
  stepId: z.string().trim().min(1).max(100),
  confirmed: z.boolean().nullable().optional(),
  measuredValue: z.string().trim().max(100).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  noPhotoReason: z.string().trim().max(2000).nullable().optional(),
});

export const saveInspectionStepsSchema = z.object({
  steps: z.array(inspectionStepPatchSchema).max(500),
});

export type SaveInspectionStepsInput = z.infer<typeof saveInspectionStepsSchema>;

export const completeInspectionRunSchema = z.object({
  result: z.enum(["passed", "passed_with_conditions", "failed"]).optional(),
  note: z.string().trim().max(4000).nullable().optional(),
  /** E90 — Prüfplakette on STK/DGUV pass. */
  labelNumber: z
    .string()
    .trim()
    .regex(/^[A-Z]{2}-\d{4}-\d{4}$/)
    .nullable()
    .optional(),
  labelNextDue: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}(-\d{2})?$/)
    .nullable()
    .optional(),
  captureMode: z
    .enum(["device_protocol", "manual_measurement", "visual"])
    .nullable()
    .optional(),
  protocolBlobId: z.string().trim().min(1).nullable().optional(),
});

export type CompleteInspectionRunInput = z.infer<typeof completeInspectionRunSchema>;

export const createTestEquipmentSchema = z.object({
  classCode: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(200),
  serialNumber: z.string().trim().max(120).nullable().optional(),
  calibratedUntil: z.string().trim().max(32).nullable().optional(),
  traceabilityRef: z.string().trim().max(200).nullable().optional(),
});

export type CreateTestEquipmentInput = z.infer<typeof createTestEquipmentSchema>;

export const updateTestEquipmentSchema = z.object({
  classCode: z.string().trim().min(1).max(80).optional(),
  label: z.string().trim().min(1).max(200).optional(),
  serialNumber: z.string().trim().max(120).nullable().optional(),
  calibratedUntil: z.string().trim().max(32).nullable().optional(),
  traceabilityRef: z.string().trim().max(200).nullable().optional(),
  active: z.boolean().optional(),
  /** D9 — OrgMembership currently holding this instrument. */
  assignedMembershipId: z.string().trim().min(1).nullable().optional(),
});

export type UpdateTestEquipmentInput = z.infer<typeof updateTestEquipmentSchema>;

/** D3 — propose a Nachbesuch child ServiceRequest from a failed inspection. */
export const proposeFollowUpSchema = z.object({
  followUpNeeds: z.string().trim().min(1).max(2000),
  followUpUrgency: z.enum(["low", "normal", "high"]).optional(),
  reason: z.enum(["befund", "stoerung", "instandsetzung"]).default("befund"),
});

export type ProposeFollowUpInput = z.infer<typeof proposeFollowUpSchema>;

/** D10 — inspector / institution seal signature. */
export const inspectionSignatureSchema = z.object({
  kind: z.enum(["inspector", "institution"]),
  signerName: z.string().trim().max(200).nullable().optional(),
  signerRole: z.string().trim().max(200).nullable().optional(),
  signedAt: z.string().trim().nullable().optional(),
  absent: z.boolean().optional(),
  absentReason: z.string().trim().max(2000).nullable().optional(),
  /** Optional canvas PNG data URL — stored as AttachmentBlob, linked via blobId. */
  imageDataUrl: z.string().trim().max(2_000_000).nullable().optional(),
});

export type InspectionSignatureInput = z.infer<typeof inspectionSignatureSchema>;

/** D11 — Mangelbild photo for a failed step. */
export const inspectionStepPhotoSchema = z.object({
  dataUrl: z.string().trim().min(32).max(8_000_000),
});

export type InspectionStepPhotoInput = z.infer<typeof inspectionStepPhotoSchema>;

/** P3 — partner_hint clarification from a failed step. */
export const inspectionPartnerHintSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  stepLabel: z.string().trim().max(200).optional(),
});

export type InspectionPartnerHintInput = z.infer<typeof inspectionPartnerHintSchema>;

/** Day-plan site card — start ServiceVisit for open job refs. */
export const startSiteVisitSchema = z.object({
  siteId: z.string().trim().min(1).nullable().optional(),
  references: z.array(z.string().trim().min(1)).max(200).default([]),
});

export type StartSiteVisitInput = z.infer<typeof startSiteVisitSchema>;

/** E34 — second visit of the day (new travel). */
export const SECOND_VISIT_REASONS = [
  "notfall",
  "teile",
  "kunde",
  "sonstiges",
] as const;

export const secondSiteVisitSchema = z.object({
  reason: z.enum(SECOND_VISIT_REASONS),
  note: z.string().trim().max(500).optional().nullable(),
  references: z.array(z.string().trim().min(1)).max(200).default([]),
});

export type SecondSiteVisitInput = z.infer<typeof secondSiteVisitSchema>;
