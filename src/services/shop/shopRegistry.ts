import type { ShopProvider, ShopProviderId } from "@/services/shop/types";
import { oxidShopProvider } from "@/services/shop/providers/oxid/oxidShopProvider";
import { mockShopProvider } from "@/services/shop/providers/mock/mockShopProvider";

/** Sole module allowed to import concrete shop providers. */
const PROVIDERS: Record<ShopProviderId, ShopProvider> = {
  oxid: oxidShopProvider,
  mock: mockShopProvider,
};

export function getShopProvider(type: ShopProviderId = "oxid"): ShopProvider {
  return PROVIDERS[type] ?? PROVIDERS.oxid;
}
