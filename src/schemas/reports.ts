import { z } from "zod";

export const acknowledgePerformanceSchema = z.object({
  note: z.string().trim().max(1000).nullable().optional(),
});

export const dossierExportSchema = z.object({
  includeAttachments: z.boolean().optional(),
});

export type AcknowledgePerformanceInput = z.infer<typeof acknowledgePerformanceSchema>;
export type DossierExportInput = z.infer<typeof dossierExportSchema>;
