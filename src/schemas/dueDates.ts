import { z } from "zod";

export const dueDatesQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
});

export const createDutyAssignmentSchema = z.object({
  note: z.string().trim().max(2000).nullable().optional(),
});

export type DueDatesQueryInput = z.infer<typeof dueDatesQuerySchema>;
export type CreateDutyAssignmentInput = z.infer<typeof createDutyAssignmentSchema>;
