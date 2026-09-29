import { z } from "zod";

export const redeemPasswordResetSchema = z
  .object({
    token: z.string().trim().min(1, "Token is required."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(200, "Password is too long."),
    confirmPassword: z.string().min(1, "Please confirm the password."),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type RedeemPasswordResetInput = z.infer<typeof redeemPasswordResetSchema>;
