import { z } from "zod";

export const DEFAULT_SHOP_SCOPE =
  "api objects.me.read objects.items.read objects.orders.write objects.orders.read objects.recommendations.read";

export const upsertShopConnectionSchema = z.object({
  provider: z.enum(["oxid", "mock"]).default("oxid"),
  shopBaseUrl: z.string().trim().min(1).max(500),
  clientId: z.string().trim().min(1).max(200),
  /** Omit or empty to keep the existing secret. */
  clientSecret: z.string().trim().min(1).max(500).optional(),
  scope: z.string().trim().min(1).max(500).optional(),
  configJson: z
    .object({
      paymentId: z.string().trim().max(100).optional(),
      deliverySetId: z.string().trim().max(100).optional(),
    })
    .optional(),
});

export type UpsertShopConnectionInput = z.infer<typeof upsertShopConnectionSchema>;

export const submitShopOrderSchema = z.object({
  pin: z
    .string()
    .trim()
    .regex(/^\d{3,11}$/, "PIN must be 3–11 digits.")
    .optional(),
  deliveryAddressId: z.string().trim().max(100).nullable().optional(),
  clearBasket: z.boolean().optional(),
});

export type SubmitShopOrderInput = z.infer<typeof submitShopOrderSchema>;
