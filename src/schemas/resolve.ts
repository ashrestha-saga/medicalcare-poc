import { z } from "zod";

/**
 * Section 16.1 — tenantId is deliberately NOT accepted from the browser.
 * The server session provides tenant context.
 */
export const resolveRequestSchema = z.object({
  raw: z.string().trim().min(1).max(256),
  context: z.literal("service"),
  /**
   * When true, skip GTIN multi-match picker and go straight to catalog/BEUDAMED/capture
   * (used by registration and by “continue without selection”).
   */
  skipInventoryCandidates: z.boolean().optional(),
});

export type ResolveRequestInput = z.infer<typeof resolveRequestSchema>;

export const resolveSelectSchema = z.object({
  deviceId: z.string().trim().min(1).max(64),
  /** Echo of the original resolve correlation id when available. */
  correlationId: z.string().trim().max(128).optional(),
  raw: z.string().trim().max(256).optional(),
});

export type ResolveSelectInput = z.infer<typeof resolveSelectSchema>;

export const captureRequestSchema = z.object({
  name: z.string().trim().min(2, "Please enter the device name.").max(200),
  manufacturer: z.string().trim().max(200).optional().or(z.literal("")),
  number: z.string().trim().max(100).optional().or(z.literal("")),
  numberType: z.enum(["gtin", "pzn", "manufacturer", "none"]).default("none"),
  rawIdentifier: z.string().trim().max(256).optional(),
  /** Nameplate photo, data URL, already downscaled client-side (NFA-803). */
  nameplatePhoto: z
    .string()
    .min(1, "Please add the nameplate photo.")
    .refine((v) => v.startsWith("data:image/"), "Nameplate photo must be an image."),
  // NOTE: `serviceOnly` is intentionally absent — it is never read from the client (DAT-302a).
});

export type CaptureRequestInput = z.infer<typeof captureRequestSchema>;
