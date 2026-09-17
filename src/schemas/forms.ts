import { z } from "zod";

/**
 * Client-side service-request form fields (before payload assembly).
 * Mirrors the UI checks in ServiceRequestForm; server still validates the DTO.
 */
export const serviceRequestFormSchema = z
  .object({
    serviceType: z.string().trim().min(1, "Please choose a service or inspection type."),
    site: z.string().trim().min(1, "Please choose a site."),
    room: z.string().trim().min(1, "Please enter the location of use."),
    deliveryAddress: z.string().trim().min(1, "Please enter the delivery address."),
    classificationConfirmed: z.boolean(),
    requiresClassificationConfirm: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.requiresClassificationConfirm && !value.classificationConfirmed) {
      ctx.addIssue({
        code: "custom",
        path: ["classification"],
        message: "Please confirm the suggested inspection type.",
      });
    }
  });

export type ServiceRequestFormInput = z.infer<typeof serviceRequestFormSchema>;

/** Complete-maintenance work note on the requests detail screen. */
export const completeWorkNoteSchema = z.object({
  note: z.string().trim().min(1, "Please enter a work note.").max(2000),
});

export type CompleteWorkNoteInput = z.infer<typeof completeWorkNoteSchema>;

/** Manual capture form (name + nameplate) before POST /api/captures. */
export const manualCaptureFormSchema = z.object({
  name: z.string().trim().min(2, "Please enter the device name.").max(200),
  hasNameplatePhoto: z
    .boolean()
    .refine((value) => value === true, "Please add the nameplate photo."),
});

export type ManualCaptureFormInput = z.infer<typeof manualCaptureFormSchema>;
