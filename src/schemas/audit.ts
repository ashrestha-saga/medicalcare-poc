import { z } from "zod";

export const auditListQuerySchema = z.object({
  resource: z.string().trim().min(1).max(64).optional(),
  resourceId: z.string().trim().min(1).max(191).optional(),
  actorKind: z.string().trim().min(1).max(32).optional(),
  organisationId: z.string().trim().min(1).max(191).optional(),
  actorUserId: z.string().trim().min(1).max(191).optional(),
  from: z.string().trim().min(1).optional(),
  to: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  cursor: z.string().trim().min(1).max(191).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  format: z.enum(["csv", "json"]).optional(),
});
