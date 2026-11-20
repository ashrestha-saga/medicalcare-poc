import { z } from "zod";

export const createEquipmentSchema = z.object({
  label: z.string().trim().min(1).max(200),
  manufacturer: z.string().trim().max(200).optional().nullable(),
  modelName: z.string().trim().max(200).optional().nullable(),
  serialNumber: z.string().trim().max(128).optional().nullable(),
  inventoryNumber: z.string().trim().min(1).max(64).optional().nullable(),
  areaId: z.string().trim().min(1),
  room: z.string().trim().max(128).optional().nullable(),
  responsiblePerson: z.string().trim().min(1).max(200),
  responsibleUserId: z.string().trim().min(1).optional().nullable(),
  protectionClass: z.enum(["I", "II", "III"]).default("I"),
  portable: z.boolean().default(false),
  electrical: z.boolean().default(true),
  year: z.number().int().min(1970).max(2100).optional().nullable(),
});

export type CreateEquipmentInput = z.infer<typeof createEquipmentSchema>;

export const dguvDeterminationSchema = z
  .object({
    state: z.enum(["own_check", "covered_by_stk", "not_applicable"]),
    intervalMonths: z.number().int().min(1).max(120).optional().nullable(),
    gbuRef: z.string().trim().min(1).max(500),
    reason: z.string().trim().max(2000).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.state === "own_check" && !(v.intervalMonths && v.intervalMonths > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "intervalMonths required for own_check",
        path: ["intervalMonths"],
      });
    }
    if (!/GBU/i.test(v.gbuRef)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "gbuRef must reference a GBU identifier (e.g. GBU-…)",
        path: ["gbuRef"],
      });
    }
  });

export type DguvDeterminationInput = z.infer<typeof dguvDeterminationSchema>;

export const dguvBatchDeterminationSchema = z.object({
  deviceIds: z.array(z.string().trim().min(1)).min(1).max(200),
  determination: dguvDeterminationSchema,
});

export type DguvBatchDeterminationInput = z.infer<typeof dguvBatchDeterminationSchema>;

export const dguvShortCompleteSchema = z.object({
  kind: z.literal("dguv_short"),
  performedBy: z.string().trim().min(1).max(200),
  performedAt: z.string().trim().optional().nullable(),
  result: z.enum(["passed", "failed"]),
  labelNumber: z
    .string()
    .trim()
    .regex(/^[A-Z]{2}-\d{4}-\d{4}$/, "Label format e.g. DG-2026-0144")
    .optional()
    .nullable(),
  measurements: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        value: z.number(),
        unit: z.string().trim().min(1),
        limit: z.number().optional().nullable(),
        withinLimit: z.boolean(),
      }),
    )
    .min(1)
    .max(10),
  note: z.string().trim().max(2000).optional().nullable(),
});

export type DguvShortCompleteInput = z.infer<typeof dguvShortCompleteSchema>;
