import type { SparePartDTO } from "@/interfaces";
import type { OxidCategorySearchResult } from "@/interfaces/external";
import { env } from "@/lib/env";
import { errorMessage, logger } from "@/lib/logger";
import { DEMO_SPARE_PARTS } from "@/constants/demoCatalog";
import { oxidHttpCategoryAdapter } from "@/services/adapters/oxidHttpAdapter";
import { oxidMockCategoryAdapter } from "@/services/adapters/oxidMockAdapter";
import type { OxidCatalogAdapter } from "@/services/adapters/types";
import { recordExternalCall } from "@/services/shared/externalCallLog";

/**
 * OXID as a *catalog source* (brief item #1). Dispatch lives in dispatchService,
 * kept separate on purpose (Section 27).
 */
export function selectOxidCategoryAdapter(mode = env.oxid.adapterMode): OxidCatalogAdapter {
  return mode === "http" ? oxidHttpCategoryAdapter : oxidMockCategoryAdapter;
}

export function createOxidService(adapter: OxidCatalogAdapter = selectOxidCategoryAdapter()) {
  return {
    async searchCategories(input: { query: string; tenantId: string; modelId?: string; correlationId?: string }): Promise<OxidCategorySearchResult> {
      const started = Date.now();
      // When the tenant uses the mock shop provider, serve accessories/search from the registry.
      try {
        const { shopAuthService } = await import("@/services/shop/shopAuthService");
        const { shopConnectionService } = await import("@/services/shop/shopConnectionService");
        const { getShopProvider } = await import("@/services/shop/shopRegistry");
        const providerType = await shopConnectionService.getProviderType(input.tenantId);
        if (providerType === "mock") {
          const session = await shopAuthService.getSession(input.tenantId);
          if (session) {
            const provider = getShopProvider("mock");
            const q = input.query.trim().toLowerCase();
            const all = await provider.catalog.findAccessories?.(session, "") ?? [];
            const articles = all.filter(
              (a) =>
                !q ||
                a.title.toLowerCase().includes(q) ||
                a.articleNumber.toLowerCase().includes(q),
            );
            await recordExternalCall({
              system: "oxid",
              operation: "searchCategories",
              identifier: input.query || "*",
              tenantId: input.tenantId,
              correlationId: input.correlationId,
              durationMs: Date.now() - started,
              cacheHit: false,
              success: true,
            });
            return {
              query: input.query,
              categories: [],
              articles: articles.map((a) => ({
                id: a.id,
                articleNumber: a.articleNumber,
                title: a.title,
                manufacturer: a.manufacturer,
                gtin: a.gtin,
                price: a.unitPrice,
                currency: a.currency,
                categoryId: null,
              })),
              fetchedAt: new Date().toISOString(),
              source: "oxid-mock",
            };
          }
        }
      } catch {
        /* fall through to legacy adapters */
      }
      try {
        const result = await adapter.searchCategories(input);
        await recordExternalCall({
          system: "oxid", operation: "searchCategories", identifier: input.query || "*", tenantId: input.tenantId,
          correlationId: input.correlationId, durationMs: Date.now() - started, cacheHit: false, success: true,
        });
        return result;
      } catch (error) {
        await recordExternalCall({
          system: "oxid", operation: "searchCategories", identifier: input.query || "*", tenantId: input.tenantId,
          correlationId: input.correlationId, durationMs: Date.now() - started, cacheHit: false, success: false, error: errorMessage(error),
        });
        logger.warn("oxid.search_failed_fallback", { correlationId: input.correlationId, error: errorMessage(error) });
        // Demo catalog fallback keeps the parts flow usable when OXID is down.
        return {
          query: input.query,
          categories: [],
          articles: DEMO_SPARE_PARTS.filter((p) => !input.modelId || p.fitsModelIds.length === 0 || p.fitsModelIds.includes(input.modelId)).map((p) => ({
            id: p.id, articleNumber: p.articleNumber, title: p.description, manufacturer: p.manufacturer, gtin: null,
            price: p.unitPrice, currency: p.currency, categoryId: null,
          })),
          fetchedAt: new Date().toISOString(),
          source: "oxid-mock",
        };
      }
    },
  };
}

export const oxidService = createOxidService();

/** OXID article → SparePartDTO used by the cart UI. */
export function toSpareParts(result: OxidCategorySearchResult, modelId?: string): SparePartDTO[] {
  return result.articles.map((a) => ({
    id: a.id,
    articleNumber: a.articleNumber,
    description: a.title,
    manufacturer: a.manufacturer,
    unitPrice: a.price,
    currency: a.currency,
    fitsModelIds: modelId ? [modelId] : [],
    category: result.categories.find((c) => c.id === a.categoryId)?.name ?? "Spare parts",
  }));
}
