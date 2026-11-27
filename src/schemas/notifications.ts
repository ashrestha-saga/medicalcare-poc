import { z } from "zod";

export const notificationListQuerySchema = z.object({
  state: z.enum(["unread", "open", "all"]).default("open"),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const notificationPreferencesSchema = z.object({
  mail: z.enum(["off", "daily"]),
});

export const pushNotificationSchema = z.object({
  kind: z.string().trim().min(1).max(64),
  dedupKey: z.string().trim().min(1).max(191),
  title: z.string().trim().min(1).max(300),
  body: z.string().trim().max(4000).nullable().optional(),
});

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;
