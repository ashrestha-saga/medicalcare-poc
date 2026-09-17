import { z } from "zod";
import type { UserRole } from "@/interfaces/session";

export const userRoleSchema = z.enum(["superadmin", "device_admin", "security_officer", "user"]);

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(200, "Password is too long.");

export const createUserSchema = z
  .object({
    email: z.string().trim().email("Please enter a valid email.").max(200),
    name: z.string().trim().min(1, "Please enter a name.").max(120),
    role: userRoleSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm the password."),
    active: z.boolean().default(true),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const updateUserSchema = z.object({
  name: z.string().trim().min(1, "Please enter a name.").max(120),
  role: userRoleSchema,
  active: z.boolean(),
});

export const resetUserPasswordSchema = z
  .object({
    adminPassword: z.string().min(1, "Enter your admin password."),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm the new password."),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;

export type AssignableRole = UserRole;
