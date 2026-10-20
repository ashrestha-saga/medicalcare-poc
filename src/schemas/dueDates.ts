import { z } from "zod";

const DUTY_KEYS = [
  "wartung",
  "stk",
  "mtk",
  "abnahme",
  "konstanz",
  "sv",
  "aerztl",
  "nuklear",
  "itsec",
  "install",
  "aufbereitung",
  "kontrolle",
  "validierung",
  "validierung_verweis",
  "einmalprodukt",
  "zubehoer",
  "vernetzung",
  "implantat",
  "dguv",
] as const;

export const dueDatesQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  /** Status / assignment chip — same as DueDatesBoardFilter. */
  filter: z.enum(["all", "due", "overdue", "unassigned", "open"]).optional(),
  dutyKey: z.enum(DUTY_KEYS).optional(),
  /** Exact duty row (dashboard “When it falls due” deep-link). */
  dutyId: z.string().trim().min(1).max(64).optional(),
  /** Upcoming window in days: dueAt in [today, today+N]. */
  horizon: z.coerce.number().int().positive().max(365).optional(),
  /**
   * unverified = confidence ≠ verified (dashboard fristen-ohne-beleg).
   * Or an exact Confidence value.
   */
  confidence: z
    .enum(["unverified", "verified", "responsible", "determination", "derived", "not_applicable"])
    .optional(),
  /** scheduled=1 → dueAt is set (excludes open takt / unset deadlines). */
  scheduled: z
    .union([z.literal("1"), z.literal("true"), z.literal("0"), z.literal("false")])
    .optional(),
  limit: z.coerce.number().int().positive().max(300).optional(),
  offset: z.coerce.number().int().min(0).max(100_000).optional(),
});

export const createDutyAssignmentSchema = z.object({
  note: z.string().trim().max(2000).nullable().optional(),
});

export type DueDatesQueryInput = z.infer<typeof dueDatesQuerySchema>;
export type CreateDutyAssignmentInput = z.infer<typeof createDutyAssignmentSchema>;
