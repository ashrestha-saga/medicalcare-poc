import { z } from "zod";

export const createRoutineDefinitionSchema = z.object({
  code: z.string().trim().min(2).max(64).optional(),
  scope: z.enum(["model", "product_kind"]),
  deviceModelId: z.string().trim().min(1).max(64).nullable().optional(),
  productKindCode: z.string().trim().min(1).max(64).nullable().optional(),
  label: z.string().trim().min(2).max(500),
  cadence: z.enum(["per_use", "daily", "weekly", "monthly"]),
  checkpoints: z
    .array(z.object({ key: z.string().min(1).max(64), text: z.string().min(1).max(500) }))
    .max(40)
    .optional(),
  unit: z.string().trim().max(64).nullable().optional(),
  limitText: z.string().trim().max(200).nullable().optional(),
  basisText: z.string().trim().min(2).max(2000),
});

export const captureRoutineCheckSchema = z.object({
  checkCode: z.string().trim().min(1).max(64),
  passed: z.boolean().optional(),
  measuredValue: z.string().trim().max(120).nullable().optional(),
  findings: z
    .array(z.object({ key: z.string().min(1).max(64), finding: z.string().min(1).max(1000) }))
    .max(40)
    .optional(),
  createRequest: z.boolean().optional(),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

export type CreateRoutineDefinitionInput = z.infer<typeof createRoutineDefinitionSchema>;
export type CaptureRoutineCheckInput = z.infer<typeof captureRoutineCheckSchema>;
