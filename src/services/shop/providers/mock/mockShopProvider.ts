import { randomUUID } from "node:crypto";
import type { ShopProvider, ShopTokens } from "@/services/shop/types";
import { ShopError } from "@/services/shop/types";

const MOCK_ARTICLES = [
  {
    id: "mock-device-1",
    articleNumber: "DEV-VOLUMAT-X200",
    title: "VOLUMAT X-200 Infusion Pump",
    gtin: "04012345678901",
    manufacturer: "Demo Med",
    unitPrice: 1299.0,
    currency: "EUR",
    stockLabel: "On request",
  },
  {
    id: "mock-acc-1",
    articleNumber: "ACC-SET-01",
    title: "Infusion set compatible",
    gtin: "04012345678918",
    manufacturer: "Demo Med",
    unitPrice: 12.5,
    currency: "EUR",
    stockLabel: "In stock",
  },
  {
    id: "mock-acc-2",
    articleNumber: "ACC-FILTER-02",
    title: "Inline filter",
    gtin: "04012345678925",
    manufacturer: "Demo Med",
    unitPrice: 4.9,
    currency: "EUR",
    stockLabel: "In stock",
  },
];

const baskets = new Map<string, { id: string; articleNumber: string; amount: number; title: string; unitNetPrice: number }[]>();
const idempotency = new Map<string, { orderNumber: string; orderId: string }>();

function basketKey(token: string, pin?: string | null) {
  return `${token}::${pin?.trim() || "parent"}`;
}

/** Test helper — seed a non-empty basket for BASKET_NOT_EMPTY scenarios. */
export function seedMockBasket(accessToken: string, pin?: string | null) {
  baskets.set(basketKey(accessToken, pin), [
    {
      id: "seed-1",
      articleNumber: "SEED-ITEM",
      amount: 1,
      title: "Seeded",
      unitNetPrice: 1,
    },
  ]);
}

export const mockShopProvider: ShopProvider = {
  type: "mock",
  capabilities: { buyerPin: true, accessories: true, orderStatus: true },
  auth: {
    buildAuthorizeUrl(cfg, p) {
      return `${cfg.shopBaseUrl.replace(/\/$/, "")}/mock-oauth?state=${encodeURIComponent(p.state)}&challenge=${encodeURIComponent(p.codeChallenge)}`;
    },
    async exchangeCode() {
      const tokens: ShopTokens = {
        accessToken: `mock-access-${randomUUID()}`,
        refreshToken: `mock-refresh-${randomUUID()}`,
        expiresAt: Date.now() + 3600_000,
        scope: "api objects.me.read objects.items.read objects.orders.write",
        tokenType: "Bearer",
      };
      return tokens;
    },
    async refresh(_cfg, refreshToken) {
      return {
        accessToken: `mock-access-${randomUUID()}`,
        refreshToken,
        expiresAt: Date.now() + 3600_000,
        tokenType: "Bearer",
      };
    },
    async fetchAccount(session) {
      return {
        id: "mock-parent",
        email: "clinic@example.com",
        customerNumber: "K-104477",
        companyName: "Demo Clinic",
        displayName: "Demo Parent",
        hasSubUsers: true,
        children: [
          { id: "mock-child-1", firstName: "Ray", lastName: "Victor", customerNumber: "2021", active: true },
        ],
        deliveryAddresses: [
          { id: "mock-addr-1", label: "Main warehouse · Bonn" },
        ],
      };
    },
  },
  catalog: {
    async findArticles(_session, by, values) {
      const set = new Set(values.map((v) => v.trim()));
      return MOCK_ARTICLES.filter((a) => {
        if (by === "gtin") return Boolean(a.gtin && set.has(a.gtin));
        if (by === "oxid") return set.has(a.id);
        return set.has(a.articleNumber);
      });
    },
    async findArticleDetail(session, by, values) {
      const found = await this.findArticles(session, by, values);
      const first = found[0];
      if (!first) return null;
      const accessories = MOCK_ARTICLES.filter((a) => a.id.startsWith("mock-acc"));
      return {
        ...first,
        shortDescription: first.title,
        categories: [{ id: "mock-cat", title: "Mock category" }],
        variants: [],
        accessoryRefs: accessories.map((a) => ({ id: a.id, title: a.title })),
        crosssellingRefs: MOCK_ARTICLES.filter((a) => a.id.startsWith("mock-dev") && a.id !== first.id).map(
          (a) => ({ id: a.id, title: a.title }),
        ),
      };
    },
    async findAccessories() {
      return MOCK_ARTICLES.filter((a) => a.id.startsWith("mock-acc"));
    },
  },
  checkout: {
    async validateBuyer(_session, pin) {
      if (pin !== "1234") throw new ShopError("PIN_INVALID", "No active child user with this PIN was found.", 422);
      return { id: "mock-child-1", displayName: "Ray Victor", customerNumber: "2021" };
    },
    async getCart(session, pin) {
      const items = baskets.get(basketKey(session.accessToken, pin)) ?? [];
      return {
        items: items.map((i) => ({
          id: i.id,
          articleNumber: i.articleNumber,
          title: i.title,
          amount: i.amount,
          unitNetPrice: i.unitNetPrice,
        })),
        deliveryAddresses: [{ id: "mock-addr-1", label: "Main warehouse · Bonn" }],
        paymentMethods: [{ id: "oxidinvoice", title: "Invoice" }],
        shippingMethods: [{ id: "oxidstandard", title: "Standard" }],
        summary: {
          total: items.reduce((s, i) => s + i.unitNetPrice * i.amount, 0),
          currency: "EUR",
        },
      };
    },
    async placeOrder(session, input) {
      const key = basketKey(session.accessToken, input.pin);
      const existing = baskets.get(key) ?? [];
      if (existing.length && !input.clearBasket) {
        throw new ShopError("BASKET_NOT_EMPTY", "Shop basket already has items.", 409);
      }
      if (input.clearBasket) baskets.set(key, []);
      if (input.pin && input.pin !== "1234") {
        throw new ShopError("PIN_INVALID", "Invalid PIN", 422);
      }
      const lines = input.lines.map((l) => {
        const unitPrice = MOCK_ARTICLES.find((a) => a.articleNumber === l.articleNumber)?.unitPrice ?? 10;
        return { articleNumber: l.articleNumber, quantity: l.amount, unitPrice };
      });
      const netSubtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
      const vat = Math.round(netSubtotal * 0.19 * 100) / 100;
      const shipping = 0;
      const total = Math.round((netSubtotal + vat + shipping) * 100) / 100;
      const priceBreakdown = {
        netSubtotal,
        vat,
        grossSubtotal: Math.round((netSubtotal + vat) * 100) / 100,
        shipping,
        total,
        currency: "EUR",
      };
      const cached = idempotency.get(input.idempotencyKey);
      if (cached) {
        return {
          orderId: cached.orderId,
          orderNumber: cached.orderNumber,
          childUserId: input.pin ? "mock-child-1" : null,
          netTotal: total,
          currency: "EUR",
          priceBreakdown,
          lines,
        };
      }
      const orderId = randomUUID();
      const orderNumber = `MS-${Math.floor(100000 + Math.random() * 899999)}`;
      idempotency.set(input.idempotencyKey, { orderId, orderNumber });
      baskets.set(key, []);
      return {
        orderId,
        orderNumber,
        createdAt: new Date().toISOString(),
        childUserId: input.pin ? "mock-child-1" : null,
        netTotal: total,
        currency: "EUR",
        priceBreakdown,
        lines,
      };
    },
  },
  orders: {
    async getStatus(_session, orderNumbers) {
      return orderNumbers.map((orderNumber) => ({ orderNumber, state: "ordered" }));
    },
  },
};
