import { describe, expect, it } from "vitest";
import {
  extractCheckoutError,
  parseAccountResponse,
  parseArticleDetail,
  parseCartResponse,
  parseSubmitOrderResponse,
  parseValidatePinResponse,
  profileRequiresSessionPin,
} from "./oxidParsers";

describe("oxidParsers", () => {
  it("detects active childs for PIN requirement", () => {
    expect(profileRequiresSessionPin({ childs: [{ active: true }] })).toBe(true);
    expect(profileRequiresSessionPin({ childs: [{ active: false }] })).toBe(false);
    expect(profileRequiresSessionPin({ childs: [] })).toBe(false);
  });

  it("parses oauthme account with childs and addresses", () => {
    const account = parseAccountResponse({
      data: {
        oxid: "parent-1",
        email: "clinic@example.com",
        custnr: "K-1",
        first_name: "Clinic",
        last_name: "Buyer",
        childs: [
          { oxid: "c1", first_name: "Ray", last_name: "Victor", custnr: "2021", active: true },
        ],
        addresses: [{ oxid: "a1", street: "Main", street_no: "1", zip: "53111", city: "Bonn" }],
      },
    });
    expect(account?.hasSubUsers).toBe(true);
    expect(account?.children).toHaveLength(1);
    expect(account?.deliveryAddresses[0]?.id).toBe("a1");
  });

  it("parses validatepin success and failure", () => {
    expect(
      parseValidatePinResponse({
        success: true,
        child: { oxid: "c1", first_name: "Ray", last_name: "Victor", custnr: "2021" },
      }),
    ).toEqual({ id: "c1", displayName: "Ray Victor", customerNumber: "2021" });
    expect(parseValidatePinResponse({ success: false, error: { code: "PIN_NOT_FOUND" } })).toBeNull();
  });

  it("parses getcart payload", () => {
    const cart = parseCartResponse({
      cart: {
        items: [{ id: "i1", artnum: "ACC-1", amount: 2, unitNetPrice: 12.5, title: "Set" }],
        deliveryAddresses: [{ id: "a1", street: "Main", streetNo: "1", zip: "53111", city: "Bonn" }],
        availablePaymentMethods: [{ id: "oxidinvoice", title: "Invoice" }],
        availableShippingMethods: [{ id: "oxidstandard", title: "Standard" }],
        summary: { total: 25, currency: "EUR" },
      },
    });
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]?.articleNumber).toBe("ACC-1");
    expect(cart.paymentMethods[0]?.id).toBe("oxidinvoice");
    expect(cart.summary?.total).toBe(25);
  });

  it("parses submitorder response", () => {
    const placed = parseSubmitOrderResponse({
      order: { id: "oid", number: "SO-100", createdAt: "2026-01-01T00:00:00Z" },
    });
    expect(placed?.orderNumber).toBe("SO-100");
    expect(placed?.orderId).toBe("oid");
  });

  it("extracts CheckoutError codes", () => {
    expect(
      extractCheckoutError({ success: false, error: { code: "PIN_NOT_FOUND", message: "Nope" } }, "fallback"),
    ).toEqual({ code: "PIN_NOT_FOUND", message: "Nope" });
  });

  it("parses getArticles detail with accessories and crossselling stubs", () => {
    const detail = parseArticleDetail({
      status: "success",
      data: [
        {
          oxid: "parent-1",
          oxartnum: "VA-1",
          az_catalog_nr: "1",
          oxtitle: "Parent device",
          oxprice: "100",
          oxean: "4250002827365",
          oxshortdesc: "Short",
          oxactive: "1",
          oxpic1: "n/parent.jpg",
          oxshopid: "1",
          accessories: [{ oxid: "acc-1", oxtitle: "Cuff" }],
          crossselling: [{ oxid: "x-1", oxtitle: "Related" }],
          variants: [
            {
              oxid: "var-1",
              oxartnum: "VA-1-A",
              oxtitle: "Parent device",
              oxvarselect: "Standard",
              oxprice: "110",
              oxactive: "1",
            },
          ],
          categories: [
            { oxid: "cat-1", oxtitle: "Diagnostics" },
            { oxid: "cat-1", oxtitle: "Diagnostics" },
          ],
        },
      ],
      errors: [],
    });
    expect(detail?.id).toBe("parent-1");
    expect(detail?.articleNumber).toBe("1");
    expect(detail?.imageFile).toBe("n/parent.jpg");
    expect(detail?.shopId).toBe("1");
    expect(detail?.accessoryRefs).toEqual([{ id: "acc-1", title: "Cuff" }]);
    expect(detail?.crosssellingRefs).toEqual([{ id: "x-1", title: "Related" }]);
    expect(detail?.variants).toHaveLength(1);
    expect(detail?.categories).toHaveLength(1);
  });
});
