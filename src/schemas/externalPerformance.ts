import { z } from "zod";

/** POST /api/duties/[id]/performances/external (E108). */
export const externalPerformanceSchema = z.object({
  performedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "performedAt must be YYYY-MM-DD"),
  /** External firm / performer (frozen display name). */
  performedBy: z.string().trim().min(1, "Firm is required").max(300),
  result: z.enum(["passed", "passed_with_conditions", "failed"]),
  note: z.string().trim().max(2000).nullable().optional(),
  /** Optional report as data URL (PDF or image). */
  dataUrl: z.string().trim().min(1).optional().nullable(),
  /** Existing AttachmentBlob id (alternative to dataUrl). */
  attachmentBlobId: z.string().trim().min(1).optional().nullable(),
  /** Link to an open service request on the same duty (external fulfilment). */
  serviceRequestReference: z.string().trim().min(1).max(64).optional().nullable(),
});

export type ExternalPerformanceInput = z.infer<typeof externalPerformanceSchema>;
