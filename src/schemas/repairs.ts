import { z } from "zod";
import { normalizeEuroText } from "@/lib/euro";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const faultReportSchema = z.object({
  deviceInstanceId: z.string().min(1),
  description: z.string().min(1).max(4000),
  occurredAt: dateOnly,
  consequenceCode: z.enum(["out_of_service", "restricted", "usable"]),
  faultSince: dateOnly.optional().nullable(),
  attachmentBlobId: z.string().optional().nullable(),
  /** Client-compressed JPEG/PNG data URL — stored as AttachmentBlob on the book entry. */
  photoDataUrl: z.string().trim().min(32).max(8_000_000).optional().nullable(),
  kind: z.enum(["malfunction", "operating_error", "note"]).optional(),
});

export const triageResolveSchema = z.object({
  action: z.enum(["order", "no_action"]),
  resolutionNote: z.string().max(2000).optional().nullable(),
});

export const quoteUpsertSchema = z.object({
  scopeText: z.string().min(1).max(4000),
  amountText: z
    .string()
    .min(1)
    .max(200)
    .transform((raw, ctx) => {
      const normalized = normalizeEuroText(raw);
      if (!normalized) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Amount must be a valid euro value (e.g. 430,00)",
        });
        return z.NEVER;
      }
      return normalized;
    }),
});

export const quoteDecideSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  decisionNote: z.string().max(2000).optional().nullable(),
});

export const unlockDeviceSchema = z.object({
  note: z.string().min(1).max(2000),
});

export const replacementSchema = z
  .object({
    instanceId: z.string().optional(),
    create: z
      .object({
        inventoryNumber: z.string().min(1),
        serialNumber: z.string().optional().nullable(),
        modelId: z.string().optional().nullable(),
        loanerLender: z.string().min(1),
        areaId: z.string().optional().nullable(),
        room: z.string().optional().nullable(),
      })
      .optional(),
  })
  .refine((v) => Boolean(v.instanceId || v.create), {
    message: "instanceId or create required",
  });

export const discardProposalSchema = z.object({
  note: z.string().min(1).max(2000),
});

export const sendInStepSchema = z.object({
  step: z.enum(["shipped", "at_workshop", "returned", "arrived"]),
  date: dateOnly,
  trackingRef: z.string().max(200).optional().nullable(),
});

export const trainingGateSchema = z.object({
  manufacturer: z.string().min(1).max(200),
  gate: z.enum(["hint", "block"]),
});

export const externalRepairSchema = z.object({
  deviceInstanceId: z.string().min(1),
  performedAt: dateOnly,
  action: z.string().min(1).max(200),
  resultText: z.string().min(1).max(4000),
  externalPerformer: z.string().min(1).max(300),
  result: z
    .enum(["repaired", "provisional", "not_repairable", "parts_ordered"])
    .optional()
    .nullable(),
  reportBlobId: z.string().optional().nullable(),
  partsText: z.string().max(4000).optional().nullable(),
  laborMinutes: z.number().int().nonnegative().optional().nullable(),
  createFollowUp: z.boolean().optional(),
  followUpSkippedReason: z.string().max(2000).optional().nullable(),
});

export const completeRepairSchema = z.object({
  inspectionRunId: z.string().min(1),
  result: z.enum(["repaired", "provisional", "not_repairable", "parts_ordered"]),
  action: z.string().min(1).max(200),
  cause: z.string().max(4000).optional().nullable(),
  faultConfirmed: z.boolean().optional().nullable(),
  laborMinutes: z.number().int().nonnegative().optional().nullable(),
  softwareBefore: z.string().max(100).optional().nullable(),
  softwareAfter: z.string().max(100).optional().nullable(),
  functionTestPassed: z.boolean().optional().nullable(),
  safetyRelevant: z.boolean(),
  resultText: z.string().max(4000).optional().nullable(),
  parts: z
    .array(
      z.object({
        description: z.string().min(1),
        partNo: z.string().optional().nullable(),
        serialNo: z.string().optional().nullable(),
        qty: z.number().int().positive().optional(),
      }),
    )
    .default([]),
  followUpUrgency: z.string().max(100).optional().nullable(),
});

export const partsProposalOrderSchema = z.object({
  orderRef: z.string().min(1).max(100),
});

export const partsProposalDiscardSchema = z.object({
  reason: z.string().min(1).max(2000),
});

const partnerCreateOrderServiceTypes = [
  "repair",
  "post_repair_check",
  "STK",
  "MTK",
  "DGUV",
  "SOFTWARE",
  "RADIATION",
  "OTHER",
] as const;

/** Partner console „Auftrag anlegen“ (phone-path order). */
export const partnerCreateOrderSchema = z
  .object({
    idempotencyKey: z
      .string()
      .trim()
      .min(8)
      .max(128)
      .regex(/^[A-Za-z0-9._:-]+$/),
    tenantId: z.string().trim().min(1).max(100),
    deviceInstanceId: z.string().trim().min(1).max(100),
    serviceType: z.enum(partnerCreateOrderServiceTypes),
    reason: z.enum(["faelligkeit", "befund", "rueckruf", "stoerung", "instandsetzung"]),
    fulfilment: z.enum(["on_site", "send_in"]).default("on_site"),
    urgency: z.enum(["immediate", "with_next_due", "at_appointment"]).default("immediate"),
    faultDescription: z.string().trim().max(4000).optional().nullable(),
    faultSince: dateOnly.optional().nullable(),
    faultConsequence: z.enum(["out_of_service", "restricted", "usable"]).optional().nullable(),
    faultReportedBy: z.string().trim().max(200).optional().nullable(),
    photoDataUrl: z.string().trim().min(32).max(8_000_000).optional().nullable(),
    workshopName: z.string().trim().max(300).optional().nullable(),
    appointmentAt: z.string().datetime({ offset: true }).optional().nullable(),
    assigneeUserId: z.string().trim().min(1).max(100).optional().nullable(),
    note: z.string().trim().max(2000).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.reason === "stoerung") {
      if (!v.faultDescription?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["faultDescription"],
          message: "Fault description required for Störung",
        });
      }
      if (!v.faultConsequence) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["faultConsequence"],
          message: "Consequence required for Störung",
        });
      }
      if (!v.faultReportedBy?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["faultReportedBy"],
          message: "Reported-by required for Störung",
        });
      }
    }
    if (v.fulfilment === "send_in" && !v.workshopName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["workshopName"],
        message: "Workshop required for send-in",
      });
    }
    if (v.fulfilment === "on_site" && v.urgency === "at_appointment" && !v.appointmentAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["appointmentAt"],
        message: "Appointment required",
      });
    }
  });

export type PartnerCreateOrderInput = z.infer<typeof partnerCreateOrderSchema>;
