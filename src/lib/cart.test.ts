import { describe, expect, it } from "vitest";
import type { SparePartDTO } from "@/interfaces";
import { addToCart, cartTotal, clampQty, itemCount, removeFromCart, setQuantity, toOrderItems } from "./cart";

const part = (id: string, price: number | null = 10, currency = "EUR"): SparePartDTO => ({
  id,
  articleNumber: `A-${id}`,
  description: `Part ${id}`,
  manufacturer: null,
  unitPrice: price,
  currency,
  fitsModelIds: [],
  category: "x",
});

describe("cart math", () => {
  it("adds and merges quantities", () => {
    let cart = addToCart([], part("a"));
    cart = addToCart(cart, part("a"), 2);
    cart = addToCart(cart, part("b"));
    expect(cart).toHaveLength(2);
    expect(cart[0].quantity).toBe(3);
    expect(itemCount(cart)).toBe(4);
  });

  it("setQuantity to zero removes the line", () => {
    const cart = setQuantity(addToCart([], part("a")), "a", 0);
    expect(cart).toHaveLength(0);
  });

  it("clamps quantities into 1..999", () => {
    expect(clampQty(0)).toBe(1);
    expect(clampQty(5000)).toBe(999);
    expect(clampQty(NaN)).toBe(1);
    expect(clampQty(2.6)).toBe(3);
  });

  it("totals with rounding, null when a price is missing or currencies mix", () => {
    const cart = addToCart(addToCart([], part("a", 10.005), 3), part("b", 0.1));
    expect(cartTotal(cart)).toEqual({ amount: 30.12, currency: "EUR" });
    expect(cartTotal(addToCart([], part("c", null)))).toBeNull();
    expect(cartTotal(addToCart(addToCart([], part("a")), part("d", 5, "USD")))).toBeNull();
    expect(cartTotal([])).toEqual({ amount: 0, currency: "EUR" });
  });

  it("maps to order items", () => {
    const items = toOrderItems(addToCart([], part("a"), 2));
    expect(items).toEqual([{ articleId: "a", articleNumber: "A-a", description: "Part a", quantity: 2, unitPrice: 10 }]);
    expect(removeFromCart(addToCart([], part("a")), "a")).toEqual([]);
  });
});
