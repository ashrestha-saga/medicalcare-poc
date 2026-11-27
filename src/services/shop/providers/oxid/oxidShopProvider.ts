import type {
  PlaceOrderInput,
  PlacedOrder,
  ShopArticle,
  ShopConfig,
  ShopProvider,
  ShopSession,
  ShopTokens,
} from "@/services/shop/types";
import { ShopError } from "@/services/shop/types";
import { oxidEndpoints } from "@/services/shop/providers/oxid/oxidEndpoints";
import { mapShopHttpError, oxidRequest } from "@/services/shop/providers/oxid/oxidClient";
import {
  parseAccessoryArticleNumbers,
  parseAccountResponse,
  parseArticleDetail,
  parseArticleRows,
  parseCartResponse,
  parseSubmitOrderResponse,
  parseTokenResponse,
  parseValidatePinResponse,
} from "@/services/shop/providers/oxid/oxidParsers";

function withOptionalPin<T extends Record<string, unknown>>(body: T, pin?: string | null): T & { pin?: string } {
  const trimmed = pin?.trim();
  if (trimmed) return { ...body, pin: trimmed };
  return body;
}

/**
 * Checkout addtocart on this shop expects az_catalog_nr (e.g. "305880"), not oxartnum ("VA-305880").
 * Sending `oxid` alongside artnum can also succeed while adding nothing — use artnum only.
 */
function orderableArtnum(articleNumber: string): string {
  const trimmed = articleNumber.trim();
  const stripped = trimmed.replace(/^VA-/i, "");
  if (stripped !== trimmed && /^[\dA-Za-z][\dA-Za-z.-]*$/.test(stripped)) return stripped;
  return trimmed;
}

function sameArtnum(a: string, b: string): boolean {
  const na = orderableArtnum(a).toLowerCase();
  const nb = orderableArtnum(b).toLowerCase();
  return na === nb || a.trim().toLowerCase() === b.trim().toLowerCase();
}

async function exchangeToken(cfg: ShopConfig, body: Record<string, string>): Promise<ShopTokens> {
  const { status, data } = await oxidRequest({
    url: oxidEndpoints.token(cfg.shopBaseUrl),
    method: "POST",
    encoding: "form",
    body: { ...body, client_id: cfg.clientId, client_secret: cfg.clientSecret },
  });
  const parsed = parseTokenResponse(data);
  if (status >= 400 || !parsed) throw mapShopHttpError(status, data, "Token exchange failed");
  return parsed;
}

export const oxidShopProvider: ShopProvider = {
  type: "oxid",
  capabilities: { buyerPin: true, accessories: true, orderStatus: true },
  auth: {
    buildAuthorizeUrl(cfg, p) {
      const url = new URL(oxidEndpoints.authorize(cfg.shopBaseUrl));
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", cfg.clientId);
      url.searchParams.set("redirect_uri", cfg.redirectUri);
      url.searchParams.set("scope", cfg.scope);
      url.searchParams.set("state", p.state);
      url.searchParams.set("code_challenge", p.codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
      return url.toString();
    },
    exchangeCode(cfg, p) {
      return exchangeToken(cfg, {
        grant_type: "authorization_code",
        code: p.code,
        redirect_uri: cfg.redirectUri,
        code_verifier: p.codeVerifier,
      });
    },
    refresh(cfg, refreshToken) {
      return exchangeToken(cfg, {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      });
    },
    async revoke(cfg, token, hint = "access_token") {
      await oxidRequest({
        url: oxidEndpoints.revoke(cfg.shopBaseUrl),
        method: "POST",
        encoding: "form",
        body: { token, token_type_hint: hint },
      });
    },
    async fetchAccount(session) {
      const { status, data } = await oxidRequest({
        url: oxidEndpoints.me(session.config.shopBaseUrl),
        method: "GET",
        token: session.accessToken,
      });
      const account = parseAccountResponse(data);
      if (status >= 400 || !account) throw mapShopHttpError(status, data, "Failed to load shop profile");
      return account;
    },
  },
  catalog: {
    async findArticles(session, by, values) {
      const ids = values.map((v) => v.trim()).filter(Boolean);
      if (!ids.length) return [];
      // Prefer oxean (shop EAN column); try gtin last. POST getArticles.
      const attempts: Array<Record<string, string[]>> =
        by === "gtin"
          ? [
              { oxean: ids },
              { oxean: ids.map((g) => g.replace(/^0+/, "") || g) },
              { gtin: ids },
            ]
          : by === "oxid"
            ? [{ oxid: ids }]
            : [{ oxartnum: ids }];

      let last: ShopArticle[] = [];
      let lastError: ReturnType<typeof mapShopHttpError> | null = null;
      for (const body of attempts) {
        const { status, data } = await oxidRequest({
          url: oxidEndpoints.articles(session.config.shopBaseUrl),
          method: "POST",
          token: session.accessToken,
          body,
        });
        if (status >= 400) {
          // Continue other lookup keys (e.g. gtin 404 → still try oxean / vice versa).
          lastError = mapShopHttpError(status, data, "Article lookup failed");
          if (status === 401 || status === 403) throw lastError;
          continue;
        }
        last = parseArticleRows(data);
        if (last.length) return last;
      }
      if (!last.length && lastError) throw lastError;
      return last;
    },
    async findArticleDetail(session, by, values) {
      const ids = values.map((v) => v.trim()).filter(Boolean);
      if (!ids.length) return null;
      const attempts: Array<Record<string, string[]>> =
        by === "gtin"
          ? [
              { oxean: ids },
              { oxean: ids.map((g) => g.replace(/^0+/, "") || g) },
              { gtin: ids },
            ]
          : by === "oxid"
            ? [{ oxid: ids }]
            : [{ oxartnum: ids }];

      let lastError: ReturnType<typeof mapShopHttpError> | null = null;
      for (const body of attempts) {
        const { status, data } = await oxidRequest({
          url: oxidEndpoints.articles(session.config.shopBaseUrl),
          method: "POST",
          token: session.accessToken,
          body,
        });
        if (status >= 400) {
          lastError = mapShopHttpError(status, data, "Article lookup failed");
          if (status === 401 || status === 403) throw lastError;
          continue;
        }
        const detail = parseArticleDetail(data);
        if (detail) return detail;
      }
      if (lastError) throw lastError;
      return null;
    },
    async findAccessories(session, articleNumber) {
      const { status, data } = await oxidRequest({
        url: oxidEndpoints.recommendations(session.config.shopBaseUrl),
        method: "POST",
        token: session.accessToken,
        body: { articles: [articleNumber] },
      });
      if (status >= 400) {
        // Recommendations module may be off — treat as empty, not fatal.
        if (status === 403 || status === 404) return [];
        throw mapShopHttpError(status, data, "Accessories lookup failed");
      }
      const nums = parseAccessoryArticleNumbers(data, articleNumber);
      if (!nums.length) return [];
      return this.findArticles(session, "articleNumber", nums);
    },
  },
  checkout: {
    async validateBuyer(session, pin) {
      const { status, data } = await oxidRequest({
        url: oxidEndpoints.validatePin(session.config.shopBaseUrl),
        method: "POST",
        token: session.accessToken,
        body: { pin },
      });
      const buyer = parseValidatePinResponse(data);
      if (status >= 400 || !buyer) throw mapShopHttpError(status || 422, data, "Invalid PIN");
      return buyer;
    },
    async getCart(session, pin) {
      const { status, data } = await oxidRequest({
        url: oxidEndpoints.getCart(session.config.shopBaseUrl),
        method: "POST",
        token: session.accessToken,
        body: withOptionalPin({}, pin),
      });
      if (status >= 400) throw mapShopHttpError(status, data, "Failed to load shop cart");
      return parseCartResponse(data);
    },
    async placeOrder(session, input: PlaceOrderInput): Promise<PlacedOrder> {
      const cart = await this.getCart(session, input.pin);
      if (cart.items.length > 0 && !input.clearBasket) {
        throw new ShopError("BASKET_NOT_EMPTY", "Shop basket already has items.", 409, {
          itemCount: cart.items.length,
        });
      }
      if (cart.items.length > 0 && input.clearBasket) {
        const { status, data } = await oxidRequest({
          url: oxidEndpoints.updateCart(session.config.shopBaseUrl),
          method: "POST",
          token: session.accessToken,
          body: withOptionalPin(
            { items: cart.items.map((i) => ({ id: i.id, amount: 0 })) },
            input.pin,
          ),
        });
        if (status >= 400) throw mapShopHttpError(status, data, "Failed to clear shop cart");
      }

      if (input.lines.length === 0) {
        throw new ShopError("LINE_REJECTED", "No articles to add to the shop cart.", 422);
      }

      const addArticles = input.lines.map((l) => ({
        artnum: orderableArtnum(l.articleNumber),
        amount: l.amount,
      }));
      const { status: addStatus, data: addData } = await oxidRequest({
        url: oxidEndpoints.addToCart(session.config.shopBaseUrl),
        method: "POST",
        token: session.accessToken,
        body: withOptionalPin({ articles: addArticles }, input.pin),
      });
      const addFailed =
        addStatus >= 400 ||
        (addData != null &&
          typeof addData === "object" &&
          !Array.isArray(addData) &&
          (addData as { success?: unknown }).success === false);
      if (addFailed) throw mapShopHttpError(addStatus >= 400 ? addStatus : 422, addData, "Failed to add articles to cart");

      const priced = await this.getCart(session, input.pin);
      if (priced.items.length === 0) {
        throw new ShopError(
          "LINE_REJECTED",
          "Shop cart is empty after adding articles. Check article numbers / shop ids.",
          422,
          { lines: input.lines, addArticles },
        );
      }
      // Shop may return success:true while silently skipping some artnums (e.g. VA-prefixed oxartnum).
      const missing = input.lines.filter((line) => {
        const hit = priced.items.find(
          (i) =>
            sameArtnum(i.articleNumber, line.articleNumber) ||
            (line.shopArticleId && i.articleId === line.shopArticleId),
        );
        return !hit || hit.amount < line.amount;
      });
      if (missing.length) {
        throw new ShopError(
          "LINE_REJECTED",
          `Could not add ${missing.length} article(s) to the shop cart (${missing.map((m) => m.articleNumber).join(", ")}).`,
          422,
          { missing, cartItems: priced.items, addArticles },
        );
      }
      // Default payment method id for this shop: oxidinvoice.
      const paymentId = input.paymentId || session.config.paymentId || "oxidinvoice";
      const deliverySetId =
        input.deliverySetId ||
        session.config.deliverySetId ||
        priced.shippingMethods[0]?.id ||
        undefined;

      const { status, data } = await oxidRequest({
        url: oxidEndpoints.submitOrder(session.config.shopBaseUrl),
        method: "POST",
        token: session.accessToken,
        headers: { "Idempotency-Key": input.idempotencyKey },
        body: withOptionalPin(
          {
            ...(paymentId ? { payment_id: paymentId } : {}),
            ...(deliverySetId ? { delivery_set_id: deliverySetId } : {}),
            ...(input.deliveryAddressId ? { delivery_address_id: input.deliveryAddressId } : {}),
            ...(input.remark ? { remark: input.remark } : {}),
          },
          input.pin,
        ),
      });
      const placed = parseSubmitOrderResponse(data);
      if ((status >= 400 && status !== 201) || !placed) {
        throw mapShopHttpError(status, data, "Order submission failed");
      }
      placed.netTotal = priced.summary?.total ?? priced.summary?.grossSubtotal ?? null;
      placed.currency = priced.summary?.currency ?? "EUR";
      placed.priceBreakdown = priced.summary
        ? {
            netSubtotal: priced.summary.netSubtotal ?? null,
            vat: priced.summary.vat ?? null,
            grossSubtotal: priced.summary.grossSubtotal ?? null,
            shipping: priced.summary.shipping ?? null,
            total: priced.summary.total ?? priced.summary.grossSubtotal ?? null,
            currency: priced.summary.currency ?? "EUR",
          }
        : null;
      placed.lines = priced.items.map((i) => ({
        articleNumber: i.articleNumber,
        quantity: i.amount,
        unitPrice: i.unitNetPrice ?? null,
      }));
      return placed;
    },
  },
  orders: {
    async getStatus(session, orderNumbers) {
      if (!orderNumbers.length) return [];
      const { status, data } = await oxidRequest({
        url: oxidEndpoints.getOrders(session.config.shopBaseUrl),
        method: "POST",
        token: session.accessToken,
        body: { orders: orderNumbers },
      });
      if (status >= 400) throw mapShopHttpError(status, data, "Failed to load orders");
      const root = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
      const rows = Array.isArray(root.data)
        ? root.data
        : Array.isArray(root.orders)
          ? root.orders
          : [];
      return rows.map((row) => {
        const obj = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
        const orderNumber = String(obj.oxordernr ?? obj.number ?? "");
        return {
          orderNumber,
          state: String(obj.oxtransstatus ?? obj.state ?? "ordered"),
          raw: row,
        };
      });
    },
  },
};
