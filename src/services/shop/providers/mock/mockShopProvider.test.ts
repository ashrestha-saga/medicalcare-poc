import { describe, expect, it } from "vitest";
import { mockShopProvider, seedMockBasket } from "./mockShopProvider";

function session(token = `tok-${Math.random()}`) {
  return {
    config: {
      shopBaseUrl: "https://shop.example.com",
      clientId: "id",
      clientSecret: "secret",
      scope: "api",
      redirectUri: "https://app.example.com/auth/callback",
    },
    accessToken: token,
  };
}

describe("mockShopProvider", () => {
  it("validates PIN and rejects wrong PIN", async () => {
    const buyer = await mockShopProvider.checkout.validateBuyer(session(), "1234");
    expect(buyer.displayName).toContain("Ray");
    await expect(mockShopProvider.checkout.validateBuyer(session(), "0000")).rejects.toMatchObject({
      code: "PIN_INVALID",
    });
  });

  it("places order with idempotency key reuse", async () => {
    const s = session();
    const key = `idem-${Math.random()}`;
    const first = await mockShopProvider.checkout.placeOrder(s, {
      lines: [{ articleNumber: "ACC-SET-01", amount: 1 }],
      pin: "1234",
      idempotencyKey: key,
    });
    const second = await mockShopProvider.checkout.placeOrder(s, {
      lines: [{ articleNumber: "ACC-SET-01", amount: 1 }],
      pin: "1234",
      idempotencyKey: key,
    });
    expect(second.orderNumber).toBe(first.orderNumber);
  });

  it("rejects non-empty basket unless clearBasket", async () => {
    const token = `tok-basket-${Math.random()}`;
    const s = session(token);
    seedMockBasket(token, "1234");
    await expect(
      mockShopProvider.checkout.placeOrder(s, {
        lines: [{ articleNumber: "ACC-SET-01", amount: 1 }],
        pin: "1234",
        idempotencyKey: `k-${Math.random()}`,
      }),
    ).rejects.toMatchObject({ code: "BASKET_NOT_EMPTY" });

    const placed = await mockShopProvider.checkout.placeOrder(s, {
      lines: [{ articleNumber: "ACC-SET-01", amount: 1 }],
      pin: "1234",
      idempotencyKey: `k-${Math.random()}`,
      clearBasket: true,
    });
    expect(placed.orderNumber).toMatch(/^MS-/);
  });

  it("finds articles by gtin and accessories", async () => {
    const found = await mockShopProvider.catalog.findArticles(session(), "gtin", ["04012345678901"]);
    expect(found[0]?.articleNumber).toBe("DEV-VOLUMAT-X200");
    const acc = await mockShopProvider.catalog.findAccessories!(session(), "DEV-VOLUMAT-X200");
    expect(acc.length).toBeGreaterThan(0);
  });
});
