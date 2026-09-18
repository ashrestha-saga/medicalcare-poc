import { z } from "zod";

const cycleMonthsSchema = z
  .number()
  .int()
  .min(1, "Maintenance cycle must be at least 1 month.")
  .max(120, "Maintenance cycle must be at most 120 months.")
  .nullable()
  .optional();

/** POST /api/devices — inventarize a catalog/BEUDAMED model as a tenant DeviceInstance. */
export const createDeviceSchema = z.object({
  modelId: z.string().trim().min(1),
  serialNumber: z.string().trim().min(1, "Seriennummer ist erforderlich.").max(128),
  responsibleUserId: z.string().trim().min(1).nullable().optional(),
  /** @deprecated Prefer responsibleUserId — kept for backward compatibility. */
  responsiblePerson: z.string().trim().max(128).nullable().optional(),
  areaId: z.string().trim().min(1).nullable().optional(),
  room: z.string().trim().max(128).nullable().optional(),
  /** ISO date or year (YYYY) → stored as commissionedAt. */
  commissionedAt: z.string().trim().nullable().optional(),
  /** Override model default; omit to inherit DeviceModel.maintenanceCycleMonths. */
  maintenanceCycleMonths: cycleMonthsSchema,
});

export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;

/** Client-side inventarize form — serial required; inventarnummer is server-assigned. */
export const inventarizeFormSchema = z.object({
  serialNumber: z.string().trim().min(1, "Seriennummer ist erforderlich.").max(128),
  responsibleUserId: z.string().trim().min(1).optional(),
  commissionedAt: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^\d{4}$/.test(v) || !Number.isNaN(Date.parse(v)), {
      message: "Ungültiges Anschaffungsjahr.",
    }),
  maintenanceCycleMonths: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 120), {
      message: "Maintenance cycle must be 1–120 months.",
    }),
});

export type InventarizeFormInput = z.infer<typeof inventarizeFormSchema>;

/** PATCH /api/devices/[id] — instance fields (+ optional linked model display fields). Classification is never accepted. */
export const updateDeviceSchema = z
  .object({
    inventoryNumber: z.string().trim().min(1).max(64).optional(),
    serialNumber: z.string().trim().max(128).nullable().optional(),
    responsibleUserId: z.string().trim().min(1).nullable().optional(),
    /** @deprecated Prefer responsibleUserId. */
    responsiblePerson: z.string().trim().max(128).nullable().optional(),
    room: z.string().trim().max(128).nullable().optional(),
    areaId: z.string().trim().min(1).nullable().optional(),
    /** ISO date or year (YYYY) → stored as commissionedAt. */
    commissionedAt: z.string().trim().nullable().optional(),
    maintenanceCycleMonths: cycleMonthsSchema,
    /** Linked DeviceModel fields (apply to all instances of the model). */
    tradeName: z.string().trim().max(200).nullable().optional(),
    modelName: z.string().trim().max(200).nullable().optional(),
    manufacturer: z.string().trim().max(200).nullable().optional(),
    udiDi: z.string().trim().max(64).nullable().optional(),
    modelMaintenanceCycleMonths: cycleMonthsSchema,
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "No changes provided." });

export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;

/** POST /api/devices/[id]/maintenance-complete */
export const completeMaintenanceSchema = z.object({
  performedAt: z.string().trim().nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
});

export type CompleteMaintenanceInput = z.infer<typeof completeMaintenanceSchema>;
