import type {
  PlacedOrder,
  ShopAccount,
  ShopArticle,
  ShopArticleDetail,
  ShopArticleRef,
  ShopBuyer,
  ShopCart,
  ShopCartLine,
  ShopCategoryRef,
  ShopTokens,
} from "@/services/shop/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function num(value: unknown, fallback = NaN): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function parseTokenResponse(raw: unknown): ShopTokens | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const accessToken = text(obj.access_token);
  if (!accessToken) return null;
  const expiresIn = typeof obj.expires_in === "number" ? obj.expires_in : 3600;
  return {
    accessToken,
    refreshToken: text(obj.refresh_token) || undefined,
    expiresAt: Date.now() + expiresIn * 1000,
    scope: text(obj.scope) || undefined,
    tokenType: text(obj.token_type) || "Bearer",
  };
}

export function profileRequiresSessionPin(profile: {
  childs?: Array<{ active?: boolean } | null | undefined> | null;
}): boolean {
  const childs = profile.childs?.filter(Boolean) ?? [];
  if (!childs.length) return false;
  return childs.some((c) => c?.active !== false);
}

export function parseAccountResponse(raw: unknown): ShopAccount | null {
  const root = asRecord(raw);
  if (!root) return null;
  const data = asRecord(root.data) ?? root;
  const id = text(data.oxid) || text(data.sub);
  if (!id) return null;
  const childsRaw = Array.isArray(data.childs) ? data.childs : [];
  const children = childsRaw
    .map((c) => {
      const row = asRecord(c);
      if (!row) return null;
      const childId = text(row.oxid) || text(row.id);
      if (!childId) return null;
      return {
        id: childId,
        firstName: text(row.first_name) || undefined,
        lastName: text(row.last_name) || undefined,
        customerNumber: text(row.custnr) || undefined,
        active: row.active !== false,
      };
    })
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const addressesRaw = Array.isArray(data.addresses) ? data.addresses : [];
  const deliveryAddresses = addressesRaw
    .map((a, i) => {
      const row = asRecord(a);
      if (!row) return null;
      const addrId = text(row.oxid) || text(row.id) || String(i);
      const street = [text(row.street), text(row.street_no)].filter(Boolean).join(" ");
      const city = [text(row.zip), text(row.city)].filter(Boolean).join(" ");
      const label = [street, city, text(row.company)].filter(Boolean).join(" · ") || addrId;
      return { id: addrId, label };
    })
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  const displayName = [text(data.first_name), text(data.last_name)].filter(Boolean).join(" ")
    || text(data.email)
    || id;

  return {
    id,
    email: text(data.email) || undefined,
    customerNumber: text(data.custnr) || undefined,
    companyName: text(asRecord(data.billing)?.company) || text(data.company) || undefined,
    displayName,
    hasSubUsers: profileRequiresSessionPin({ childs: childsRaw as Array<{ active?: boolean }> }),
    children,
    deliveryAddresses,
  };
}

export function parseValidatePinResponse(raw: unknown): ShopBuyer | null {
  const root = asRecord(raw);
  if (!root || root.success === false) return null;
  const child = asRecord(root.child) ?? asRecord(asRecord(root.data)?.child);
  if (!child) return null;
  const id = text(child.oxid) || text(child.id);
  if (!id) return null;
  const displayName = [text(child.first_name), text(child.last_name)].filter(Boolean).join(" ") || id;
  return {
    id,
    displayName,
    customerNumber: text(child.custnr) || undefined,
  };
}

export function extractCheckoutError(raw: unknown, fallback: string): { code: string; message: string } {
  const root = asRecord(raw);
  if (!root) return { code: "UNAVAILABLE", message: fallback };
  const err = asRecord(root.error);
  if (err) {
    return {
      code: text(err.code) || "VALIDATION",
      message: text(err.message) || fallback,
    };
  }
  for (const key of ["message", "error_description", "error"]) {
    const v = root[key];
    if (typeof v === "string" && v.trim()) return { code: "VALIDATION", message: v.trim() };
  }
  return { code: "UNAVAILABLE", message: fallback };
}

function parseCartLine(row: unknown): ShopCartLine | null {
  const obj = asRecord(row);
  if (!obj) return null;
  const id = text(obj.id) || text(obj.oxid) || text(obj.basketitemid);
  const articleNumber = text(obj.artnum) || text(obj.oxartnum) || text(obj.sku);
  const amount = num(obj.amount ?? obj.qty ?? obj.oxamount);
  if (!id || !articleNumber || !Number.isFinite(amount) || amount <= 0) return null;
  return {
    id,
    articleId: text(obj.articleId) || text(obj.oxid) || undefined,
    articleNumber,
    title: text(obj.title) || text(obj.oxtitle) || undefined,
    amount: Math.floor(amount),
    unitNetPrice: Number.isFinite(num(obj.unitNetPrice ?? obj.price ?? obj.oxprice))
      ? num(obj.unitNetPrice ?? obj.price ?? obj.oxprice)
      : undefined,
  };
}

export function parseCartResponse(raw: unknown): ShopCart {
  const root = asRecord(raw);
  const cart = asRecord(root?.cart) ?? asRecord(asRecord(root?.data)?.cart) ?? root;
  const itemsRaw = Array.isArray(cart?.items) ? cart!.items : [];
  const items = itemsRaw.map(parseCartLine).filter((l): l is ShopCartLine => Boolean(l));
  const deliveryRaw = Array.isArray(cart?.deliveryAddresses) ? cart!.deliveryAddresses : [];
  const deliveryAddresses = deliveryRaw
    .map((a) => {
      const row = asRecord(a);
      if (!row) return null;
      const id = text(row.id) || text(row.oxid);
      if (!id) return null;
      const label = [text(row.street), text(row.streetNo), text(row.zip), text(row.city)]
        .filter(Boolean)
        .join(" ") || id;
      return { id, label };
    })
    .filter((a): a is NonNullable<typeof a> => Boolean(a));
  const paymentMethods = (Array.isArray(cart?.availablePaymentMethods) ? cart!.availablePaymentMethods : [])
    .map((p) => {
      const row = asRecord(p);
      if (!row || !text(row.id)) return null;
      return { id: text(row.id), title: text(row.title) || text(row.id) };
    })
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const shippingMethods = (Array.isArray(cart?.availableShippingMethods) ? cart!.availableShippingMethods : [])
    .map((p) => {
      const row = asRecord(p);
      if (!row || !text(row.id)) return null;
      return { id: text(row.id), title: text(row.title) || text(row.id) };
    })
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const summary = asRecord(cart?.summary) ?? undefined;
  return {
    items,
    deliveryAddresses,
    paymentMethods,
    shippingMethods,
    summary: summary
      ? {
          netSubtotal: num(summary.netSubtotal, undefined as unknown as number),
          vat: num(summary.vat, undefined as unknown as number),
          grossSubtotal: num(summary.grossSubtotal, undefined as unknown as number),
          shipping: num(summary.shipping, undefined as unknown as number),
          total: num(summary.total, undefined as unknown as number),
          currency: text(summary.currency) || "EUR",
        }
      : undefined,
  };
}

function parseArticleRefList(value: unknown): ShopArticleRef[] {
  if (!Array.isArray(value)) return [];
  const out: ShopArticleRef[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const obj = asRecord(item);
    if (!obj) continue;
    const id = text(obj.oxid) || text(obj.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, title: text(obj.oxtitle) || text(obj.title) || id });
  }
  return out;
}

function parseCategoryList(value: unknown): ShopCategoryRef[] {
  if (!Array.isArray(value)) return [];
  const out: ShopCategoryRef[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const obj = asRecord(item);
    if (!obj) continue;
    const id = text(obj.oxid) || text(obj.id);
    const title = text(obj.oxtitle) || text(obj.title);
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, title });
  }
  return out;
}

function parseOneArticle(obj: Record<string, unknown>): ShopArticle | null {
  // Prefer az_catalog_nr for checkout: this shop's addtocart rejects oxartnum values like "VA-305880"
  // but accepts catalog nr "305880". Fall back to oxartnum when catalog nr is absent.
  const articleNumber = text(obj.az_catalog_nr) || text(obj.oxartnum);
  const title = text(obj.oxtitle);
  if (!articleNumber && !title && !text(obj.oxid)) return null;
  const id = text(obj.oxid) || articleNumber;
  if (!id) return null;
  const gtin = text(obj.oxean) || text(obj.gtin) || text(obj.oxdistean) || null;
  const price = num(obj.oxprice);
  const activeRaw = obj.oxactive;
  const active =
    activeRaw === undefined || activeRaw === null
      ? true
      : activeRaw === "1" || activeRaw === 1 || activeRaw === true;
  const imageFile =
    text(obj.oxpic1) || text(obj.oxthumb) || text(obj.oxicon) || null;
  const shopId = text(obj.oxshopid) || null;
  const variantCountRaw = num(obj.oxvarcount, Number.NaN);
  const variantCount = Number.isFinite(variantCountRaw) ? variantCountRaw : null;
  return {
    id,
    articleNumber: articleNumber || id,
    title: title || articleNumber || id,
    gtin,
    manufacturer: text(obj.oxmanufacturername) || text(obj.manufacturer) || null,
    unitPrice: Number.isFinite(price) ? price : null,
    currency: "EUR",
    stockLabel: text(obj.oxstocktext) || null,
    shortDescription: text(obj.oxshortdesc) || text(obj.nxsdetails) || null,
    variantLabel: text(obj.oxvarselect) || null,
    active,
    imageFile,
    shopId,
    variantCount,
  };
}

export function parseArticleRows(raw: unknown): ShopArticle[] {
  const root = asRecord(raw);
  if (!root || root.status !== "success" || !Array.isArray(root.data)) return [];
  return root.data
    .map((row) => {
      const obj = asRecord(row);
      if (!obj) return null;
      return parseOneArticle(obj);
    })
    .filter((a): a is ShopArticle => Boolean(a));
}

/** First getArticles row with variants + accessory/crossselling stubs. */
export function parseArticleDetail(raw: unknown): ShopArticleDetail | null {
  const root = asRecord(raw);
  if (!root || root.status !== "success" || !Array.isArray(root.data) || !root.data[0]) return null;
  const obj = asRecord(root.data[0]);
  if (!obj) return null;
  const base = parseOneArticle(obj);
  if (!base) return null;

  const variantsRaw = Array.isArray(obj.variants) ? obj.variants : [];
  const variants = variantsRaw
    .map((v) => {
      const row = asRecord(v);
      return row ? parseOneArticle(row) : null;
    })
    .filter((a): a is ShopArticle => Boolean(a));

  return {
    ...base,
    shortDescription: base.shortDescription ?? null,
    categories: parseCategoryList(obj.categories),
    variants,
    accessoryRefs: parseArticleRefList(obj.accessories),
    crosssellingRefs: parseArticleRefList(obj.crossselling),
  };
}

export function parseAccessoryArticleNumbers(raw: unknown, forArticle: string): string[] {
  const root = asRecord(raw);
  if (!root || !Array.isArray(root.data)) return [];
  const out: string[] = [];
  for (const entry of root.data) {
    const row = asRecord(entry);
    if (!row) continue;
    if (text(row.artnum) && text(row.artnum) !== forArticle && !out.includes(text(row.artnum))) {
      // top-level artnum is the input article
    }
    const recs = Array.isArray(row.recommendations) ? row.recommendations : [];
    for (const rec of recs) {
      const block = asRecord(rec);
      if (!block) continue;
      for (const key of ["accessories", "crossselling"] as const) {
        const list = block[key];
        if (!Array.isArray(list)) continue;
        for (const item of list) {
          if (typeof item === "string" && item.trim()) {
            if (!out.includes(item.trim())) out.push(item.trim());
            continue;
          }
          const obj = asRecord(item);
          const art =
            text(obj?.bestellnummer) ||
            text(obj?.oxartnum) ||
            text(obj?.artnum) ||
            text(obj?.articleNumber);
          if (art && art !== forArticle && !out.includes(art)) out.push(art);
        }
      }
    }
  }
  return out;
}

export function parseSubmitOrderResponse(raw: unknown): PlacedOrder | null {
  const root = asRecord(raw);
  const order =
    asRecord(root?.order) ??
    asRecord(asRecord(root?.data)?.order) ??
    null;
  if (!order) return null;
  const number =
    text(order.number) ||
    text(order.oxordernr) ||
    (typeof order.number === "number" ? String(order.number) : "");
  if (!number) return null;
  return {
    orderId: text(order.id) || undefined,
    orderNumber: number,
    createdAt: text(order.createdAt) || undefined,
    childUserId: text(order.childUserId) || null,
    netTotal: null,
    currency: "EUR",
    lines: [],
  };
}
