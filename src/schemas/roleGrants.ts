import { z } from "zod";
import { USER_ROLES } from "@/constants/roles";

export const updateRoleGrantsSchema = z.object({
  permissions: z.array(z.string().trim().min(1)).max(200),
});

export type UpdateRoleGrantsInput = z.infer<typeof updateRoleGrantsSchema>;

export const roleSlugSchema = z
  .string()
  .trim()
  .refine((v): v is (typeof USER_ROLES)[number] => USER_ROLES.includes(v as (typeof USER_ROLES)[number]), {
    message: "Unknown role.",
  });
