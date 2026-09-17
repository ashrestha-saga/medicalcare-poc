import { z } from "zod";
import { INSPECTION_TYPE_CODES, PRIORITIES } from "@/constants/inspectionTypes";

const softwareClassSchema = z.enum(["IIb", "III", "C", "D"]).nullable();

export const classificationProposalSchema = z.object({
  annex1: z.boolean().nullable(),
  annex2: z.boolean().nullable(),
  softwareClass: softwareClassSchema,
  radiation: z.boolean().nullable(),
  confidence: z.enum(["verified", "derived", "guess"]),
  source: z.string().max(500),
  ruleId: z.string().optional(),
});

export const classificationSubmissionSchema = z.object({
  proposed: classificationProposalSchema.nullable(),
  selected: z.array(z.number().int().min(0).max(50)).max(50),
  confirmed: z.boolean(),
  overridden: z.boolean(),
});

const MAX_DATA_URL_BYTES = 1_500_000; // ~1.5 MB — a 1600px JPEG is far below this (NFA-803)

export const attachmentInputSchema = z.object({
  kind: z.enum(["nameplate", "fault_photo"]),
  url: z
    .string()
    .max(MAX_DATA_URL_BYTES, "Attachment too large — photos must be downscaled to 1600px.")
    .refine(
      (v) => v.startsWith("data:image/") || /^https?:\/\//.test(v),
      "Attachment must be an image data URL or an https URL.",
    ),
});

const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8, "idempotencyKey is required.")
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, "idempotencyKey contains invalid characters.");

/** Section 16.2 — structural validation. Business rules live in serviceRequestService. */
export const createServiceRequestSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  subjectType: z.enum(["instance", "model", "captured"]),
  subjectId: z.string().trim().min(1).max(100),
  serviceType: z.enum(INSPECTION_TYPE_CODES as [string, ...string[]]),
  priority: z.enum(PRIORITIES).optional(),
  note: z.string().trim().max(2000).optional(),
  site: z.string().trim().min(1, "Please choose a site.").max(100),
  locationText: z.string().trim().min(1, "Please enter the location of use.").max(300),
  accessHint: z.string().trim().max(300).optional(),
  contact: z.string().trim().max(200).optional(),
  deliveryAddress: z.string().trim().min(1, "Please enter the delivery address.").max(500),
  classification: classificationSubmissionSchema.optional(),
  attachments: z.array(attachmentInputSchema).max(6).optional(),
  raisedBy: z.string().trim().min(1).max(200),
  correlationId: z.string().trim().max(64).optional(),
});

export type CreateServiceRequestInput = z.infer<typeof createServiceRequestSchema>;

export const statusFeedbackSchema = z.object({
  state: z.enum(["transmitted", "acknowledged", "in_progress", "completed", "rejected"]),
  source: z.string().trim().min(1).max(50),
  actor: z.string().trim().max(200).optional(),
  note: z.string().trim().max(1000).optional(),
  externalReference: z.string().trim().max(200).optional(),
});

export type StatusFeedbackInput = z.infer<typeof statusFeedbackSchema>;

/** In-app technician transitions (DeviceCare is system of record for clinic-side work). */
export const transitionServiceRequestSchema = z.object({
  state: z.enum(["in_progress", "completed"]),
  note: z.string().trim().max(2000).optional(),
});

export type TransitionServiceRequestInput = z.infer<typeof transitionServiceRequestSchema>;

export const serviceRequestListScopeSchema = z.enum(["mine", "open", "all"]);
export type ServiceRequestListScope = z.infer<typeof serviceRequestListScopeSchema>;
