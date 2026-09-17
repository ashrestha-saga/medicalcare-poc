import type { DeviceModelDTO, DispatchAdapter, DispatchResult, DispatchTargetDTO, DispatchableServiceRequest, ParsedIdentifier } from "@/interfaces";
import type { OxidCategorySearchResult } from "@/interfaces/external";
import { DEMO_SPARE_PARTS } from "@/constants/demoCatalog";
import { logger } from "@/lib/logger";
import type { CatalogSearchAdapter, OxidCatalogAdapter } from "./types";

/**
 * ⚠ PENDING API SPEC — in-repo mock of OXID.
 * Deterministic, network-free. Lets Phase 3/5/9 code run end to end. Replace the
 * bodies (not the interfaces) with `oxidHttpAdapter.ts` once the contract lands.
 */

const MOCK_CATALOG: Record<string, Omit<DeviceModelDTO, "id" | "source" | "sourceFetchedAt" | "version" | "state">> = {
  // A GTIN unknown to the local DeviceModel table but known to OXID's article master.
  "04012345678932": {
    basicUdiDi: "4012345D5BASIC00",
    udiDi: "04012345678932",
    gtins: ["04012345678932"],
    manufacturer: "Example Medical",
    manufacturerSrn: "DE-MF-000012345",
    tradeName: "Defibrillator D5",
    modelName: "D5",
    riskClass: "III",
    emdnCode: "Z120401",
    gmdnCode: "17882",
  },
};

export const oxidMockCatalogSearchAdapter: CatalogSearchAdapter = {
  name: "oxid-mock",
  async search(identifier: ParsedIdentifier) {
    const key = identifier.udiDi ?? identifier.gtin;
    logger.info("oxid.catalog.request", { adapter: "oxid-mock", gtin: key ?? null, raw: identifier.raw });
    if (!key) {
      logger.info("oxid.catalog.response", { adapter: "oxid-mock", hit: false, reason: "no_gtin" });
      return null;
    }
    const hit = MOCK_CATALOG[key];
    if (!hit) {
      logger.info("oxid.catalog.response", { adapter: "oxid-mock", hit: false, gtin: key });
      return null;
    }
    const mapped = {
      id: `oxid-article-${key}`,
      ...hit,
      source: "catalog" as const,
      sourceFetchedAt: new Date().toISOString(),
      version: 1,
      state: "released" as const,
    };
    logger.info("oxid.catalog.response", {
      adapter: "oxid-mock",
      hit: true,
      gtin: key,
      modelId: mapped.id,
      tradeName: mapped.tradeName,
    });
    return { model: mapped, raw: hit };
  },
};

export const oxidMockCategoryAdapter: OxidCatalogAdapter = {
  async searchCategories({ query, modelId }) {
    const q = query.trim().toLowerCase();
    const parts = DEMO_SPARE_PARTS.filter((p) => {
      const fits = !modelId || p.fitsModelIds.length === 0 || p.fitsModelIds.includes(modelId);
      const matches =
        !q ||
        p.description.toLowerCase().includes(q) ||
        p.articleNumber.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return fits && matches;
    });
    const categories = [...new Set(parts.map((p) => p.category))].map((c) => ({
      id: `cat-${c.toLowerCase()}`,
      name: c,
      path: ["Spare parts", c],
    }));
    return {
      query,
      categories,
      articles: parts.map((p) => ({
        id: p.id,
        articleNumber: p.articleNumber,
        title: p.description,
        manufacturer: p.manufacturer,
        gtin: null,
        price: p.unitPrice,
        currency: p.currency,
        categoryId: `cat-${p.category.toLowerCase()}`,
      })),
      fetchedAt: new Date().toISOString(),
      source: "oxid-mock",
    } satisfies OxidCategorySearchResult;
  },
};

/**
 * Mock dispatch. A target whose endpoint contains "fail" always fails, so
 * dispatch isolation (SS-702 / AC-E2E-07) can be exercised without a network.
 */
export const oxidMockDispatchAdapter: DispatchAdapter = {
  type: "oxid",
  async dispatch(target: DispatchTargetDTO, payload: DispatchableServiceRequest): Promise<DispatchResult> {
    if (target.endpoint?.includes("fail")) {
      return { success: false, httpStatus: 503, error: "mock: OXID unavailable" };
    }
    return {
      success: true,
      httpStatus: 202,
      response: {
        externalReference: `OXID-${payload.request.reference}`,
        acceptedAt: new Date().toISOString(),
        mock: true,
        body: payload.exportBody,
      },
    };
  },
};
