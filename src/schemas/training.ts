import { z } from "zod";

export const createTrainingEventSchema = z
  .object({
    trainingTypeCode: z.string().trim().min(1).max(64),
    subjectModelId: z.string().trim().min(1).max(64).nullable().optional(),
    subjectActivity: z.string().trim().min(1).max(200).nullable().optional(),
    heldOn: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    location: z.string().trim().max(200).nullable().optional(),
    instructorName: z.string().trim().min(1).max(200),
    instructorQualification: z.string().trim().min(1).max(200),
    instructorExternal: z.boolean().optional().default(false),
    basisDocument: z.string().trim().min(1).max(300),
    mode: z.enum(["individual", "group"]),
    personIds: z.array(z.string().trim().min(1)).min(1).max(200),
  })
  .superRefine((value, ctx) => {
    if (value.mode === "individual" && value.personIds.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["personIds"],
        message: "Individual mode allows exactly one participant.",
      });
    }
  });

export type CreateTrainingEventInput = z.infer<typeof createTrainingEventSchema>;
