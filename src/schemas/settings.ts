import { z } from "zod";

/** PATCH /api/settings/dispatch-targets — enable/disable a channel. */
export const patchDispatchTargetSchema = z.object({
  targetId: z.string().trim().min(1),
  enabled: z.boolean(),
});

export type PatchDispatchTargetInput = z.infer<typeof patchDispatchTargetSchema>;
