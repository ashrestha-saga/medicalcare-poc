import { z } from "zod";

export const startInspectionRunSchema = z.object({
  reference: z.string().trim().min(1).max(100),
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
});

export const saveInspectionStepsSchema = z.object({
  steps: z.array(inspectionStepPatchSchema).max(500),
});

export type SaveInspectionStepsInput = z.infer<typeof saveInspectionStepsSchema>;

export const completeInspectionRunSchema = z.object({
  result: z.enum(["passed", "passed_with_conditions", "failed"]).optional(),
  note: z.string().trim().max(4000).nullable().optional(),
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
});

export type UpdateTestEquipmentInput = z.infer<typeof updateTestEquipmentSchema>;
