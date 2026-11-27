export type ShopProviderId = "oxid" | "mock";

export type ShopTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
  tokenType: string;
};

export type ShopConfig = {
  shopBaseUrl: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  redirectUri: string;
  paymentId?: string | null;
  deliverySetId?: string | null;
};

export type ShopSession = {
  config: ShopConfig;
  accessToken: string;
};

export type ShopAccountChild = {
  id: string;
  firstName?: string;
  lastName?: string;
  customerNumber?: string;
  active: boolean;
};

export type ShopDeliveryAddress = {
  id: string;
  label: string;
};

export type ShopAccount = {
  id: string;
  email?: string;
  customerNumber?: string;
  companyName?: string;
  displayName?: string;
  hasSubUsers: boolean;
  children: ShopAccountChild[];
  deliveryAddresses: ShopDeliveryAddress[];
};

export type ShopBuyer = {
  id: string;
  displayName: string;
  customerNumber?: string;
};

export type ShopArticle = {
  id: string;
  articleNumber: string;
  title: string;
  gtin: string | null;
  manufacturer: string | null;
  unitPrice: number | null;
  currency: string;
  stockLabel: string | null;
  shortDescription?: string | null;
  variantLabel?: string | null;
  active?: boolean;
  /** Raw OXID filename (oxpic1) — resolve with shopProductPictureUrl. */
  imageFile?: string | null;
  /** Absolute product image URL when shop base is known. */
  imageUrl?: string | null;
  shopId?: string | null;
  /** OXID oxvarcount — cheap signal that variants exist (list rows). */
  variantCount?: number | null;
};

export type ShopArticleRef = {
  id: string;
  title: string;
};

export type ShopCategoryRef = {
  id: string;
  title: string;
};

/** Full getArticles row with relation stubs (before OXID enrichment). */
export type ShopArticleDetail = ShopArticle & {
  shortDescription: string | null;
  categories: ShopCategoryRef[];
  variants: ShopArticle[];
  accessoryRefs: ShopArticleRef[];
  crosssellingRefs: ShopArticleRef[];
};

export type ShopCartLine = {
  id: string;
  articleId?: string;
  articleNumber: string;
  title?: string;
  amount: number;
  unitNetPrice?: number;
};

export type ShopCart = {
  items: ShopCartLine[];
  deliveryAddresses: ShopDeliveryAddress[];
  paymentMethods: { id: string; title: string }[];
  shippingMethods: { id: string; title: string }[];
  summary?: {
    netSubtotal?: number;
    vat?: number;
    grossSubtotal?: number;
    shipping?: number;
    total?: number;
    currency?: string;
  };
};

export type PlaceOrderInput = {
  lines: { articleNumber: string; amount: number; shopArticleId?: string }[];
  pin?: string | null;
  deliveryAddressId?: string | null;
  remark?: string;
  idempotencyKey: string;
  clearBasket?: boolean;
  paymentId?: string | null;
  deliverySetId?: string | null;
};

export type ShopPriceBreakdown = {
  netSubtotal?: number | null;
  vat?: number | null;
  grossSubtotal?: number | null;
  shipping?: number | null;
  total?: number | null;
  currency?: string | null;
};

export type PlacedOrder = {
  orderId?: string;
  orderNumber: string;
  createdAt?: string;
  childUserId?: string | null;
  netTotal?: number | null;
  currency?: string | null;
  priceBreakdown?: ShopPriceBreakdown | null;
  lines: {
    articleNumber: string;
    quantity: number;
    unitPrice: number | null;
  }[];
};

export type ShopOrderStatus = {
  orderNumber: string;
  state: string;
  raw?: unknown;
};

export type ShopErrorCode =
  | "PIN_INVALID"
  | "BASKET_NOT_EMPTY"
  | "LINE_REJECTED"
  | "BELOW_MIN_ORDER_VALUE"
  | "DELIVERY_ADDRESS_INVALID"
  | "UNAVAILABLE"
  | "UNAUTHORIZED"
  | "VALIDATION"
  | "CONFLICT";

export class ShopError extends Error {
  constructor(
    public readonly code: ShopErrorCode,
    message: string,
    public readonly httpStatus = 502,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ShopError";
  }
}

export interface ShopProvider {
  readonly type: ShopProviderId;
  readonly capabilities: {
    buyerPin: boolean;
    accessories: boolean;
    orderStatus: boolean;
  };
  auth: {
    buildAuthorizeUrl(cfg: ShopConfig, p: { state: string; codeChallenge: string }): string;
    exchangeCode(
      cfg: ShopConfig,
      p: { code: string; codeVerifier: string },
    ): Promise<ShopTokens>;
    refresh(cfg: ShopConfig, refreshToken: string): Promise<ShopTokens>;
    revoke?(cfg: ShopConfig, token: string, hint?: "access_token" | "refresh_token"): Promise<void>;
    fetchAccount(session: ShopSession): Promise<ShopAccount>;
  };
  catalog: {
    findArticles(
      session: ShopSession,
      by: "gtin" | "articleNumber" | "oxid",
      values: string[],
    ): Promise<ShopArticle[]>;
    /** Rich first hit including variants / accessory / crossselling refs. */
    findArticleDetail?(
      session: ShopSession,
      by: "gtin" | "articleNumber" | "oxid",
      values: string[],
    ): Promise<ShopArticleDetail | null>;
    findAccessories?(session: ShopSession, articleNumber: string): Promise<ShopArticle[]>;
  };
  checkout: {
    validateBuyer(session: ShopSession, pin: string): Promise<ShopBuyer>;
    getCart(session: ShopSession, pin?: string | null): Promise<ShopCart>;
    placeOrder(session: ShopSession, input: PlaceOrderInput): Promise<PlacedOrder>;
  };
  orders?: {
    getStatus(session: ShopSession, orderNumbers: string[]): Promise<ShopOrderStatus[]>;
  };
}
