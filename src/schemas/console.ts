import { z } from "zod";
import { CONTRACT_SCOPE_TOKENS, normalizeContractScope } from "@/constants/partnerPermissions";

export const operatingModelSchema = z.enum(["provider_operated", "institution_operated"]);

export const tenantCodeSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => /^T-[A-Z0-9]{2,12}$/.test(v), {
    message: "Tenant identifier must look like T-XXX.",
  });

export const createClinicSchema = z.object({
  name: z.string().trim().min(1, "Institution name is required.").max(191),
  street: z.string().trim().max(191).optional().or(z.literal("")),
  postalCode: z.string().trim().max(32).optional().or(z.literal("")),
  city: z.string().trim().min(1, "City is required.").max(191),
  country: z
    .string()
    .trim()
    .max(2)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v.toUpperCase() : "DE")),
  tenantCode: tenantCodeSchema,
  siteName: z.string().trim().min(1, "First site is required.").max(191),
  validFrom: z
    .string()
    .trim()
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)), {
      message: "Contract start must be YYYY-MM-DD.",
    }),
  billingRef: z.string().trim().max(191).optional().or(z.literal("")),
  operatingModel: operatingModelSchema,
  scope: z
    .array(z.string())
    .min(1, "Select at least one scope of services.")
    .transform((raw) => normalizeContractScope(raw))
    .refine((tokens) => tokens.length > 0, {
      message: "Select at least one recognised scope.",
    })
    .refine((tokens) => tokens.every((t) => (CONTRACT_SCOPE_TOKENS as readonly string[]).includes(t)), {
      message: "Unknown scope token.",
    }),
});

export type CreateClinicParsed = z.infer<typeof createClinicSchema>;

export const updateClinicContractSchema = z.object({
  validFrom: z
    .string()
    .trim()
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)), {
      message: "Contract start must be YYYY-MM-DD.",
    })
    .optional(),
  validTo: z
    .string()
    .trim()
    .nullable()
    .optional()
    .refine((v) => v == null || v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), {
      message: "Contract end must be YYYY-MM-DD or empty.",
    }),
  billingRef: z.string().trim().max(191).nullable().optional(),
  operatingModel: operatingModelSchema.optional(),
  scope: z
    .array(z.string())
    .min(1)
    .transform((raw) => normalizeContractScope(raw))
    .refine((tokens) => tokens.length > 0)
    .refine((tokens) => tokens.every((t) => (CONTRACT_SCOPE_TOKENS as readonly string[]).includes(t)))
    .optional(),
});

export type UpdateClinicContractParsed = z.infer<typeof updateClinicContractSchema>;

export const consoleStaffInviteSchema = z.object({
  email: z.string().trim().email().max(200),
  name: z.string().trim().max(120).optional().nullable(),
  appRole: z.enum(["admin", "inspector", "order"]),
});

export const consoleStaffAssignSchema = z.object({
  tenantIds: z.array(z.string().trim().min(1)).max(50),
});
