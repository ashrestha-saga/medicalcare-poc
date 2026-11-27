import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { assertSafeShopBaseUrl, shopIndexUrl, shopOrigin, shopProductPictureUrl } from "./shopUrl";

describe("assertSafeShopBaseUrl", () => {
  it("accepts https public hosts and strips trailing slash", () => {
    expect(assertSafeShopBaseUrl("https://shop.example.com/")).toBe("https://shop.example.com");
  });

  it("rejects http", () => {
    expect(() => assertSafeShopBaseUrl("http://shop.example.com")).toThrow(AppError);
  });

  it("rejects localhost and private IPs", () => {
    expect(() => assertSafeShopBaseUrl("https://localhost")).toThrow(AppError);
    expect(() => assertSafeShopBaseUrl("https://127.0.0.1")).toThrow(AppError);
    expect(() => assertSafeShopBaseUrl("https://192.168.1.10")).toThrow(AppError);
    expect(() => assertSafeShopBaseUrl("https://10.0.0.5")).toThrow(AppError);
  });

  it("rejects credentials in URL", () => {
    expect(() => assertSafeShopBaseUrl("https://user:pass@shop.example.com")).toThrow(AppError);
  });
});

describe("shopIndexUrl", () => {
  it("builds cl/fnc query", () => {
    const url = shopIndexUrl("https://shop.example.com", "checkoutapi", "getcart");
    expect(url).toContain("cl=checkoutapi");
    expect(url).toContain("fnc=getcart");
  });
});

describe("shopOrigin", () => {
  it("strips index.php and trailing slash", () => {
    expect(shopOrigin("https://shop.example.com/index.php")).toBe("https://shop.example.com");
    expect(shopOrigin("https://shop.example.com/shop/")).toBe("https://shop.example.com/shop");
  });
});

describe("shopProductPictureUrl", () => {
  it("builds master product picture path", () => {
    expect(shopProductPictureUrl("https://shop.example.com", "pump.jpg", "1")).toBe(
      "https://shop.example.com/out/pictures/master/product/1/pump.jpg",
    );
  });

  it("returns absolute URLs unchanged and null for empty file", () => {
    expect(shopProductPictureUrl("https://shop.example.com", "https://cdn.example/a.png")).toBe(
      "https://cdn.example/a.png",
    );
    expect(shopProductPictureUrl("https://shop.example.com", null)).toBeNull();
    expect(shopProductPictureUrl("https://shop.example.com", "  ")).toBeNull();
  });
});
