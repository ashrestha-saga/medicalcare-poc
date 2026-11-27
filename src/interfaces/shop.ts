export type ShopProviderType = "oxid" | "mock";
export type ShopLinkStatus = "disconnected" | "connected" | "error";
export type OrderPurpose = "device" | "parts";
export type ExternalOrderState =
  | "intent"
  | "submitting"
  | "ordered"
  | "shipped"
  | "cancelled"
  | "failed"
  | "expired";

export interface ShopConnectionStatus {
  configured: boolean;
  provider: ShopProviderType | null;
  status: ShopLinkStatus;
  shopBaseUrl: string | null;
  clientId: string | null;
  /** True when a client secret is stored (value never returned). */
  hasClientSecret: boolean;
  scope: string | null;
  customerNumber: string | null;
  companyName: string | null;
  hasSubUsers: boolean;
  connectedAt: string | null;
  lastError: string | null;
  canManage: boolean;
}

export interface ShopAuthorizeResponse {
  authorizeUrl: string;
}

export interface ShopArticleDTO {
  id: string;
  articleNumber: string;
  title: string;
  gtin: string | null;
  manufacturer: string | null;
  unitPrice: number | null;
  currency: string;
  stockLabel: string | null;
  kind: "device" | "accessory" | "suggestion";
  shortDescription?: string | null;
  variantLabel?: string | null;
  active?: boolean;
  /** Absolute shop product image URL, when available. */
  imageUrl?: string | null;
  /** True when OXID reports oxvarcount &gt; 0 (variants loaded on Add). */
  hasVariants?: boolean;
  /**
   * Active child variants when loaded on demand (Add click).
   * Absent until fetched; empty array means checked and none.
   */
  variants?: ShopArticleDTO[];
}

export interface ShopCategoryDTO {
  id: string;
  title: string;
}

export interface DeviceShopArticlesResponse {
  device: ShopArticleDTO | null;
  accessories: ShopArticleDTO[];
  source: string;
  hasSubUsers: boolean;
}

/** Shell + device tab for /shop?device=… — accessories/suggestions load per tab. */
export interface DeviceShopCatalogResponse {
  deviceInstance: {
    id: string;
    inventoryNumber: string;
    label: string;
  };
  primary: ShopArticleDTO | null;
  variants: ShopArticleDTO[];
  /** Populated only after accessories tab fetch (or legacy full load). */
  accessories: ShopArticleDTO[];
  /** Populated only after suggestions tab fetch. */
  suggestions: ShopArticleDTO[];
  accessoryCount: number;
  suggestionCount: number;
  categories: ShopCategoryDTO[];
  source: string;
  hasSubUsers: boolean;
}

export type ShopCatalogSection = "accessories" | "suggestions";

export interface DeviceShopCatalogSectionResponse {
  section: ShopCatalogSection;
  items: ShopArticleDTO[];
}

/** Lazy variant payload for a single OXID article. */
export interface ShopArticleDetailResponse {
  article: ShopArticleDTO;
  variants: ShopArticleDTO[];
}

export interface ShopDeliveryAddressDTO {
  id: string;
  label: string;
}

export interface ShopAccountResponse {
  id: string;
  displayName: string | null;
  companyName: string | null;
  customerNumber: string | null;
  hasSubUsers: boolean;
  deliveryAddresses: ShopDeliveryAddressDTO[];
}

export interface SubmitShopOrderInput {
  pin?: string;
  deliveryAddressId?: string | null;
  clearBasket?: boolean;
}

export interface SubmitShopOrderResult {
  order: {
    reference: string;
    externalState: ExternalOrderState;
    externalOrderRef: string | null;
    orderedByName: string | null;
    netTotalFromSource: number | null;
    currency: string | null;
  };
}
