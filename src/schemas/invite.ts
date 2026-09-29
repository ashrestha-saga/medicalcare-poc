import { z } from "zod";
import { ALL_PERMISSIONS } from "@/constants/permissions";
import { userRoleSchema } from "@/schemas/user";

const permissionSlugSchema = z
  .string()
  .refine((p): p is (typeof ALL_PERMISSIONS)[number] => (ALL_PERMISSIONS as readonly string[]).includes(p), {
    message: "Unknown permission.",
  });

export const createClinicInviteSchema = z.object({
  email: z.string().trim().email("Please enter a valid email.").max(200),
  name: z.string().trim().max(120).optional().nullable(),
  role: userRoleSchema,
  /** Optional full permission snapshot; omit/null ⇒ redeem uses role RoleGrant only. */
  permissions: z.array(permissionSlugSchema).optional().nullable(),
});

export const createPartnerInviteSchema = z.object({
  email: z.string().trim().email("Please enter a valid email.").max(200),
  name: z.string().trim().max(120).optional().nullable(),
  appRole: z.enum(["inspector", "admin", "order"]),
});

export const redeemInviteSchema = z
  .object({
    token: z.string().trim().min(1, "Token is required."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(200, "Password is too long."),
    confirmPassword: z.string().min(1, "Please confirm the password."),
    name: z.string().trim().max(120).optional().nullable(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type CreateClinicInviteInput = z.infer<typeof createClinicInviteSchema>;
export type CreatePartnerInviteInput = z.infer<typeof createPartnerInviteSchema>;
export type RedeemInviteInput = z.infer<typeof redeemInviteSchema>;
