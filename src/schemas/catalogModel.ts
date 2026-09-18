import { z } from "zod";

const nullableTrimmed = z
  .string()
  .trim()
  .max(200)
  .nullable()
  .optional()
  .transform((v) => (v === "" ? null : v));

export const catalogModelStateSchema = z.enum(["draft", "review", "released"]);
export const catalogModelSourceSchema = z.enum(["manual", "catalog", "beudamed"]);

export const createCatalogModelSchema = z.object({
  basicUdiDi: nullableTrimmed,
  udiDi: nullableTrimmed,
  gtins: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
  manufacturer: nullableTrimmed,
  manufacturerSrn: nullableTrimmed,
  tradeName: nullableTrimmed,
  modelName: nullableTrimmed,
  riskClass: nullableTrimmed,
  emdnCode: nullableTrimmed,
  gmdnCode: nullableTrimmed,
  source: catalogModelSourceSchema.optional().default("manual"),
  state: catalogModelStateSchema.optional().default("draft"),
  maintenanceCycleMonths: z
    .number()
    .int()
    .min(1)
    .max(120)
    .nullable()
    .optional(),
});

export const updateCatalogModelSchema = createCatalogModelSchema.partial().extend({
  source: catalogModelSourceSchema.optional(),
  state: catalogModelStateSchema.optional(),
  classification: z
    .object({
      annex1: z.boolean().nullable().optional(),
      annex2: z.boolean().nullable().optional(),
      softwareClass: z.string().trim().max(16).nullable().optional(),
      radiation: z.boolean().nullable().optional(),
    })
    .optional(),
});

export type CreateCatalogModelInput = z.infer<typeof createCatalogModelSchema>;
export type UpdateCatalogModelInput = z.infer<typeof updateCatalogModelSchema>;
