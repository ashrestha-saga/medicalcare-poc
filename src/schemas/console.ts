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

const scopeSchema = z
  .array(z.string())
  .min(1, "Select at least one scope of services.")
  .transform((raw) => normalizeContractScope(raw))
  .refine((tokens) => tokens.length > 0, {
    message: "Select at least one recognised scope.",
  })
  .refine((tokens) => tokens.every((t) => (CONTRACT_SCOPE_TOKENS as readonly string[]).includes(t)), {
    message: "Unknown scope token.",
  });

export const createClinicSchema = z
  .object({
    name: z.string().trim().min(1, "Institution name is required.").max(191),
    street: z.string().trim().max(191).optional().or(z.literal("")),
    postalCode: z.string().trim().min(1, "Postal code is required.").max(32),
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
    contactName: z.string().trim().max(191).optional().or(z.literal("")),
    contactEmail: z
      .string()
      .trim()
      .min(1, "Contact email address is required.")
      .email("Enter a valid contact email.")
      .max(200),
    mpsbName: z.string().trim().max(191).optional().or(z.literal("")),
    validFrom: z
      .string()
      .trim()
      .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)), {
        message: "Contract start must be YYYY-MM-DD.",
      }),
    billingRef: z.string().trim().max(191).optional().or(z.literal("")),
    avvRef: z.string().trim().max(191).optional().or(z.literal("")),
    operatingModel: operatingModelSchema,
    scope: scopeSchema,
  })
  .superRefine((val, ctx) => {
    if (val.operatingModel === "provider_operated" && !val.avvRef?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "AVV reference is required for provider-operated customers.",
        path: ["avvRef"],
      });
    }
  });

/** Form state before transforms (tenant code uppercasing, scope normalisation). */
export type CreateClinicInput = z.input<typeof createClinicSchema>;
export type CreateClinicParsed = z.output<typeof createClinicSchema>;

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
  avvRef: z.string().trim().max(191).nullable().optional(),
  operatingModel: operatingModelSchema.optional(),
  scope: scopeSchema.optional(),
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

/** Assign or revoke one staff membership on one managed tenant (customer detail). */
export const consoleTenantStaffAssignSchema = z.object({
  membershipId: z.string().trim().min(1),
  assigned: z.boolean(),
});

export type ConsoleTenantStaffAssignParsed = z.infer<typeof consoleTenantStaffAssignSchema>;

export const dispositionAssignSchema = z.object({
  executorOrgId: z.string().trim().min(1).nullable().optional(),
  assigneeUserId: z.string().trim().min(1).nullable().optional(),
  scheduledAt: z
    .string()
    .trim()
    .nullable()
    .optional()
    .refine((v) => v == null || v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      message: "Schedule date must be YYYY-MM-DD or empty.",
    }),
});

export type DispositionAssignParsed = z.infer<typeof dispositionAssignSchema>;

export const consoleExternalInviteSchema = z.object({
  email: z.string().trim().email().max(200),
  name: z.string().trim().max(120).optional().nullable(),
  commissionedFrom: z
    .string()
    .trim()
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), { message: "Commission start must be YYYY-MM-DD." }),
  commissionedTo: z
    .string()
    .trim()
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), { message: "Commission end must be YYYY-MM-DD." }),
  liabilityUntil: z
    .string()
    .trim()
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), { message: "Liability end must be YYYY-MM-DD." }),
  liabilitySumEur: z.number().int().positive().nullable().optional(),
});

export type ConsoleExternalInviteParsed = z.infer<typeof consoleExternalInviteSchema>;

export const consoleExternalUpdateSchema = z.object({
  commissionedFrom: z
    .string()
    .trim()
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v))
    .optional(),
  commissionedTo: z
    .string()
    .trim()
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v))
    .optional(),
  liabilityUntil: z
    .string()
    .trim()
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v))
    .optional(),
  liabilitySumEur: z.number().int().positive().nullable().optional(),
  validTo: z
    .string()
    .trim()
    .nullable()
    .optional()
    .refine((v) => v == null || v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v)),
});

export type ConsoleExternalUpdateParsed = z.infer<typeof consoleExternalUpdateSchema>;
