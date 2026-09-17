import type { CartItemDTO, CreateOrderItemDTO, SparePartDTO } from "@/interfaces";

/** Pure cart math — unit-tested (Section 38). */

export const MAX_QTY = 999;

export function addToCart(items: CartItemDTO[], part: SparePartDTO, quantity = 1): CartItemDTO[] {
  const existing = items.find((i) => i.part.id === part.id);
  if (existing) {
    return items.map((i) => (i.part.id === part.id ? { ...i, quantity: clampQty(i.quantity + quantity) } : i));
  }
  return [...items, { part, quantity: clampQty(quantity) }];
}

export function setQuantity(items: CartItemDTO[], partId: string, quantity: number): CartItemDTO[] {
  if (quantity <= 0) return items.filter((i) => i.part.id !== partId);
  return items.map((i) => (i.part.id === partId ? { ...i, quantity: clampQty(quantity) } : i));
}

export function removeFromCart(items: CartItemDTO[], partId: string): CartItemDTO[] {
  return items.filter((i) => i.part.id !== partId);
}

export function clampQty(q: number): number {
  if (!Number.isFinite(q)) return 1;
  return Math.min(MAX_QTY, Math.max(1, Math.round(q)));
}

export function itemCount(items: CartItemDTO[]): number {
  return items.reduce((n, i) => n + i.quantity, 0);
}

/** Returns null when any priced item is missing a price — never fakes a total. */
export function cartTotal(items: CartItemDTO[]): { amount: number; currency: string } | null {
  if (items.length === 0) return { amount: 0, currency: "EUR" };
  const currency = items[0].part.currency;
  let amount = 0;
  for (const i of items) {
    if (i.part.unitPrice === null || i.part.currency !== currency) return null;
    amount += i.part.unitPrice * i.quantity;
  }
  return { amount: Math.round(amount * 100) / 100, currency };
}

export function toOrderItems(items: CartItemDTO[]): CreateOrderItemDTO[] {
  return items.map((i) => ({
    articleId: i.part.id,
    articleNumber: i.part.articleNumber,
    description: i.part.description,
    quantity: i.quantity,
    unitPrice: i.part.unitPrice,
  }));
}

export function formatMoney(amount: number, currency: string, locale = "de-DE"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
}
