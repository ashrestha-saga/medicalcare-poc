import { z } from "zod";
import { INSPECTION_TYPE_CODES, PRIORITIES } from "@/constants/inspectionTypes";

const MAX_DATA_URL_BYTES = 1_500_000;

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
  attachments: z.array(attachmentInputSchema).max(6).optional(),
  raisedBy: z.string().trim().min(1).max(200),
  correlationId: z.string().trim().max(64).optional(),
  /** FA-710 — due_date | app */
  source: z.enum(["due_date", "app"]).optional(),
  /** Link to frozen duty when created from a Fälligkeit. */
  dutyId: z.string().trim().min(1).max(100).nullable().optional(),
  /** Skip auto-dispatch so allocate → transmit can run (FA-713/714). */
  deferDispatch: z.boolean().optional(),
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

export const transitionServiceRequestSchema = z.object({
  state: z.enum(["in_progress", "completed"]),
  note: z.string().trim().max(2000).optional(),
});

export type TransitionServiceRequestInput = z.infer<typeof transitionServiceRequestSchema>;

export const allocateServiceRequestSchema = z.object({
  executorOrgId: z.string().trim().min(1, "Please choose an executor."),
});

export type AllocateServiceRequestInput = z.infer<typeof allocateServiceRequestSchema>;

export const serviceRequestListScopeSchema = z.enum(["mine", "open", "all"]);
export type ServiceRequestListScope = z.infer<typeof serviceRequestListScopeSchema>;
