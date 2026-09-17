import { z } from "zod";

export const orderItemSchema = z.object({
  articleId: z.string().trim().max(100).optional(),
  articleNumber: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(300),
  quantity: z.number().int().min(1).max(999),
  unitPrice: z.number().nonnegative().nullable().optional(),
});

export const createOrderRequestSchema = z.object({
  idempotencyKey: z
    .string()
    .trim()
    .min(8)
    .max(128)
    .regex(/^[A-Za-z0-9._:-]+$/),
  subjectType: z.enum(["instance", "model", "captured"]).optional(),
  subjectId: z.string().trim().max(100).optional(),
  deliveryAddress: z.string().trim().min(1, "Please enter the delivery address.").max(500),
  note: z.string().trim().max(2000).optional(),
  items: z.array(orderItemSchema).min(1, "Add at least one spare part.").max(50),
  raisedBy: z.string().trim().min(1).max(200),
  correlationId: z.string().trim().max(64).optional(),
});

export type CreateOrderRequestInput = z.infer<typeof createOrderRequestSchema>;

export const categorySearchQuerySchema = z.object({
  q: z.string().trim().max(120).default(""),
  modelId: z.string().trim().max(100).optional(),
});
