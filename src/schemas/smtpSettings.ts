import { z } from "zod";

export const upsertSmtpSettingsSchema = z.object({
  host: z.string().trim().min(1, "Host is required.").max(200),
  port: z.coerce.number().int().min(1).max(65535).default(587),
  secure: z.boolean().default(false),
  user: z.string().trim().min(1, "Username is required.").max(200),
  /** Omit or empty to keep the existing password when updating. */
  password: z.string().max(500).optional().nullable(),
  from: z.string().trim().min(1, "From address is required.").max(200),
});

export const testSmtpSettingsSchema = z.object({
  to: z.string().trim().email("Please enter a valid email.").max(200).optional(),
});

export type UpsertSmtpSettingsInput = z.infer<typeof upsertSmtpSettingsSchema>;
export type TestSmtpSettingsInput = z.infer<typeof testSmtpSettingsSchema>;
