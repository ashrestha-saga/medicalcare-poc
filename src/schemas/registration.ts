import { z } from "zod";

const nullableTrimmed = z
  .string()
  .trim()
  .max(200)
  .nullable()
  .optional()
  .transform((v) => (v === "" || v == null ? null : v));

/** Shared identity fields for create/patch draft APIs. */
const draftIdentityFields = {
  modelId: z.string().trim().min(1).nullable().optional(),
  tradeName: z.string().trim().max(200).optional(),
  manufacturer: z.string().trim().max(200).optional(),
  modelName: z.string().trim().max(200).optional(),
  serialNumber: z.string().trim().max(128).nullable().optional(),
  udiDi: z.string().trim().max(64).nullable().optional(),
  inventoryNumber: z.string().trim().max(64).nullable().optional(),
  purchaseYear: z.number().int().min(1950).max(2100).nullable().optional(),
  responsiblePerson: z.string().trim().max(128).nullable().optional(),
  responsibleUserId: z.string().trim().min(1).nullable().optional(),
  areaId: z.string().trim().min(1).nullable().optional(),
  room: z.string().trim().max(128).nullable().optional(),
  productKindCode: z.string().trim().max(64).nullable().optional(),
  characteristics: z.record(z.string(), z.unknown()).optional(),
  keepDraft: z.boolean().optional(),
  clarifications: z
    .array(
      z.object({
        kind: z.string().trim().min(1),
        field: z.string().trim().nullable().optional(),
        prerequisiteCode: z.string().trim().nullable().optional(),
        label: z.string().trim().min(1).max(500),
      }),
    )
    .optional(),
};

export const createRegistrationDraftSchema = z.object(draftIdentityFields);

export const updateRegistrationDraftSchema = z.object({
  modelId: z.string().trim().min(1).nullable().optional(),
  tradeName: z.string().trim().max(200).optional(),
  manufacturer: z.string().trim().max(200).optional(),
  modelName: z.string().trim().max(200).optional(),
  serialNumber: z.string().trim().max(128).nullable().optional(),
  udiDi: z.string().trim().max(64).nullable().optional(),
  purchaseYear: z.number().int().min(1950).max(2100).nullable().optional(),
  responsiblePerson: z.string().trim().max(128).nullable().optional(),
  responsibleUserId: z.string().trim().min(1).nullable().optional(),
  areaId: z.string().trim().min(1).nullable().optional(),
  room: z.string().trim().max(128).nullable().optional(),
  productKindCode: z.string().trim().max(64).nullable().optional(),
  characteristics: z.record(z.string(), z.unknown()).optional(),
  keepDraft: z.boolean().optional(),
  clarifications: z
    .array(
      z.object({
        kind: z.string().trim().min(1),
        field: z.string().trim().nullable().optional(),
        prerequisiteCode: z.string().trim().nullable().optional(),
        label: z.string().trim().min(1).max(500),
      }),
    )
    .optional(),
});

export const releaseRegistrationDraftSchema = z.object({
  checks: z.record(z.string(), z.boolean()).default({}),
  classificationConfidence: z.enum(["verified", "responsible", "derived", "guess"]).optional(),
  evidenceText: z.string().trim().max(2000).nullable().optional(),
});

/** POST /api/registration/preview — derive duties without persisting a draft. */
export const registrationPreviewSchema = z.object({
  characteristics: z
    .object({
      produktart: z.string().trim().min(1, "Product kind is required."),
    })
    .passthrough(),
  areaId: z.string().trim().min(1).nullable().optional(),
  purchaseYear: z.number().int().min(1950).max(2100).nullable().optional(),
});

/** POST /api/registration/release — create (or update inventarize draft) and release in one step. */
export const commitRegistrationSchema = z.object({
  ...draftIdentityFields,
  draftId: z.string().trim().min(1).nullable().optional(),
  characteristics: z
    .object({
      produktart: z.string().trim().min(1, "Product kind is required."),
    })
    .passthrough(),
  checks: z.record(z.string(), z.boolean()).default({}),
  classificationConfidence: z.enum(["verified", "responsible", "derived", "guess"]).optional(),
  evidenceText: z.string().trim().max(2000).nullable().optional(),
});

/** Body for model-wide reclassification derive/apply. */
export const reclassifyCharacteristicsSchema = z.object({
  characteristics: z
    .object({
      produktart: z.string().trim().min(1, "Product kind is required."),
    })
    .passthrough(),
});

export const reclassifyApplySchema = z.object({
  characteristics: z
    .object({
      produktart: z.string().trim().min(1, "Product kind is required."),
    })
    .passthrough(),
  checks: z.record(z.string(), z.boolean()).default({}),
  acknowledgeImpact: z.literal(true),
  classificationConfidence: z.enum(["verified", "responsible", "derived", "guess"]).optional(),
  evidenceText: z.string().trim().max(2000).nullable().optional(),
});

/**
 * Client step-1 identity form — string fields; purchaseYear as string.
 * Requires tradeName, manufacturer, responsibleUserId, site, area, room,
 * and serialNumber or udiDi.
 */
export const registrationIdentityFormSchema = z
  .object({
    tradeName: z.string().trim().min(1, "Name is required.").max(200),
    manufacturer: z.string().trim().min(1, "Manufacturer is required.").max(200),
    modelName: z.string().trim().min(1, "Kind and type is required.").max(200),
    serialNumber: z.string().trim().max(128).optional(),
    udiDi: z.string().trim().max(64).optional(),
    inventoryNumber: z.string().trim().max(64).optional(),
    purchaseYear: z
      .string()
      .trim()
      .min(1, "Year of purchase is required.")
      .regex(/^\d{4}$/, "Enter a four-digit year."),
    responsibleUserId: z.string().trim().min(1, "Responsible person is required."),
    responsiblePerson: z.string().trim().max(128).optional(),
    siteId: z.string().trim().min(1, "Please choose a site."),
    areaId: z.string().trim().min(1, "Please choose an area."),
    room: z.string().trim().min(1, "Room is required.").max(128),
  })
  .superRefine((v, ctx) => {
    if (!v.serialNumber?.trim() && !v.udiDi?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["serialNumber"],
        message: "Serial number or UDI-DI is required.",
      });
    }
    const year = Number(v.purchaseYear);
    if (Number.isNaN(year) || year < 1950 || year > 2100) {
      ctx.addIssue({
        code: "custom",
        path: ["purchaseYear"],
        message: "Enter a valid year between 1950 and 2100.",
      });
    }
  });

/** POST /api/duties/[id]/complete */
export const completeDutySchema = z.object({
  performedAt: z.string().trim().nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
});

export type CreateRegistrationDraftInput = z.infer<typeof createRegistrationDraftSchema>;
export type UpdateRegistrationDraftInput = z.infer<typeof updateRegistrationDraftSchema>;
export type ReleaseRegistrationDraftInput = z.infer<typeof releaseRegistrationDraftSchema>;
export type RegistrationPreviewInput = z.infer<typeof registrationPreviewSchema>;
export type CommitRegistrationInput = z.infer<typeof commitRegistrationSchema>;
export type RegistrationIdentityFormInput = z.infer<typeof registrationIdentityFormSchema>;
export type ReclassifyApplyInput = z.infer<typeof reclassifyApplySchema>;
export type CompleteDutyInput = z.infer<typeof completeDutySchema>;

export { nullableTrimmed };
