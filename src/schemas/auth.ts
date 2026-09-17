import { z } from "zod";

/** Clinic email/password sign-in form + POST /api/auth/login body. */
export const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email.").max(200),
  password: z.string().min(1, "Please enter your password.").max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;

const totpCodeSchema = z
  .string()
  .trim()
  .min(1, "Enter the authentication code.")
  .max(32);

export const totpVerifySchema = z.object({
  code: totpCodeSchema,
});

export type TotpVerifyInput = z.infer<typeof totpVerifySchema>;

export const totpConfirmSetupSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app."),
});

export type TotpConfirmSetupInput = z.infer<typeof totpConfirmSetupSchema>;

export const totpDisableSchema = z.object({
  password: z.string().min(1, "Please enter your password.").max(200),
  code: totpCodeSchema,
});

export type TotpDisableInput = z.infer<typeof totpDisableSchema>;
