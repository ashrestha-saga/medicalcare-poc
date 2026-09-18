import { z } from "zod";
import { USER_ROLES } from "@/constants/roles";

export const userOptionsQuerySchema = z.object({
  /** Comma-separated roles, e.g. device_admin or device_admin,superadmin */
  roles: z
    .string()
    .trim()
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      return v
        .split(",")
        .map((r) => r.trim())
        .filter((r): r is (typeof USER_ROLES)[number] =>
          USER_ROLES.includes(r as (typeof USER_ROLES)[number]),
        );
    }),
  /** "true" | "false" | "all" — default active-only when omitted. */
  active: z
    .enum(["true", "false", "all"])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "true") return true as boolean | null;
      if (v === "false") return false;
      return null;
    }),
  q: z.string().trim().optional(),
  excludeIds: z
    .string()
    .trim()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
        : undefined,
    ),
});

export type UserOptionsQueryInput = z.infer<typeof userOptionsQuerySchema>;
