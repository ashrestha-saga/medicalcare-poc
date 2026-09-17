import { z } from "zod";

const areaNameSchema = z.string().trim().min(1, "Area name is required.").max(120);

export const createSiteSchema = z.object({
  name: z.string().trim().min(1, "Designation is required.").max(200),
  code: z
    .string()
    .trim()
    .max(40)
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  address: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  deliveryAddress: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null)),
  areaNames: z.array(areaNameSchema).max(100).optional().default([]),
});

export const updateSiteSchema = createSiteSchema;

export type CreateSiteInput = z.infer<typeof createSiteSchema>;
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;
