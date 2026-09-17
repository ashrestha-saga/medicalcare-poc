import type { DeviceModelDTO, DispatchAdapter, DispatchResult, ParsedIdentifier } from "@/interfaces";
import type { OxidCategorySearchResult } from "@/interfaces/external";
import { env } from "@/lib/env";
import { fetchJson, HttpStatusError } from "@/lib/http";
import { errorMessage, logger } from "@/lib/logger";
import { oxidEndpoint } from "@/lib/oxid/url";
import { oxidAuthService } from "@/services/oxid/oxidAuthService";
import type { CatalogSearchAdapter, OxidCatalogAdapter } from "./types";

/**
 * Real OXID HTTP adapters (Merzljak API).
 * Catalog search uses `oxean` lookup only for now.
 * Category search + dispatch remain closed until verified against the shop.
 */

/**
 * Shop stores EAN without GS1 left-padding (typically 13 digits).
 * App identifiers are normalized to GTIN-14 — send both forms so oxean matches.
 */
export function oxeanLookupValues(gtin: string, raw?: string): string[] {
  const out: string[] = [];
  const add = (value: string | null | undefined) => {
    if (!value) return;
    const digits = value.replace(/\D/g, "");
    if (!digits || out.includes(digits)) return;
    out.push(digits);
  };
  // Prefer unpadded shop form first (strip leading zeros from GTIN-14).
  add(gtin.replace(/^0+/, "") || gtin);
  add(gtin);
  add(raw);
  return out;
}

function strField(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k] ?? row[k.toUpperCase()] ?? row[k.toLowerCase()];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

/** Map a flexible OXID article row → DeviceModelDTO. */
export function mapOxidArticleToDeviceModel(row: Record<string, unknown>, lookupGtin: string): DeviceModelDTO {
  const id =
    strField(row, "oxid", "OXID", "id") ||
    `oxid-article-${lookupGtin}`;
  const artnum = strField(row, "oxartnum", "OXARTNUM", "artnum");
  const title = strField(row, "oxtitle", "OXTITLE", "title", "name");
  const ean =
    strField(row, "oxean", "OXEAN", "ean", "gtin", "oxdistean", "OXDISTEAN") || lookupGtin;
  const manufacturer = strField(row, "oxmanufacturername", "OXMANUFACTURERNAME", "manufacturer", "oxvendor");

  return {
    id,
    basicUdiDi: null,
    udiDi: ean,
    gtins: ean ? [ean] : [],
    manufacturer,
    manufacturerSrn: null,
    tradeName: title,
    modelName: artnum,
    riskClass: null,
    emdnCode: null,
    gmdnCode: null,
    source: "catalog",
    sourceFetchedAt: new Date().toISOString(),
    version: 1,
    state: "released",
  };
}

async function bearerForCatalog(tenantId?: string): Promise<string> {
  if (!tenantId) throw new Error("OXID catalog search requires a tenant");
  const token = await oxidAuthService.getAccessTokenForTenant(tenantId);
  if (!token) throw new Error("No OXID shop connection — ask an admin to link OXID in Settings");
  return token;
}

function summarizeOxidPayload(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    const rows = Array.isArray(obj.data) ? obj.data : null;
    return {
      status: obj.status ?? null,
      rowCount: rows ? rows.length : Array.isArray(data) ? (data as unknown[]).length : null,
      // Keep first row keys/values for debugging EAN mismatches (truncated).
      firstRow: rows?.[0] && typeof rows[0] === "object" ? rows[0] : Array.isArray(data) ? data[0] : null,
      rawPreview: JSON.stringify(data).slice(0, 1500),
    };
  }
  if (Array.isArray(data)) {
    return { rowCount: data.length, firstRow: data[0] ?? null, rawPreview: JSON.stringify(data).slice(0, 1500) };
  }
  return { rawPreview: String(data).slice(0, 500) };
}

export const oxidHttpCatalogSearchAdapter: CatalogSearchAdapter = {
  name: "oxid-http",
  async search(identifier, ctx) {
    const gtin = identifier.udiDi ?? identifier.gtin;
    if (!gtin) return null;

    const accessToken = await bearerForCatalog(ctx?.tenantId);
    const url = oxidEndpoint("articleapi", "getArticles");
    const oxean = oxeanLookupValues(gtin, identifier.raw);
    const body = { oxean };

    logger.info("oxid.catalog.request", {
      url,
      body,
      gtin,
      oxean,
      raw: identifier.raw,
      userId: ctx?.userId ?? null,
    });

    try {
      const { status, data } = await fetchJson<{ status?: string; data?: unknown }>(url, {
        method: "POST",
        timeoutMs: 8000,
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      logger.info("oxid.catalog.response", {
        httpStatus: status,
        gtin,
        ...summarizeOxidPayload(data),
      });

      const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      const first = rows.find((r) => r && typeof r === "object") as Record<string, unknown> | undefined;
      if (!first) {
        logger.info("oxid.catalog.empty", { gtin, httpStatus: status });
        return null;
      }
      const mapped = mapOxidArticleToDeviceModel(first, gtin);
      logger.info("oxid.catalog.mapped", {
        gtin,
        modelId: mapped.id,
        tradeName: mapped.tradeName,
        modelName: mapped.modelName,
        gtins: mapped.gtins,
      });
      return { model: mapped, raw: first };
    } catch (error) {
      const http =
        error instanceof HttpStatusError
          ? { httpStatus: error.status, bodyText: error.bodyText.slice(0, 800) }
          : {};
      logger.warn("oxid.catalog.error", {
        gtin,
        url,
        body,
        error: errorMessage(error),
        ...http,
      });
      throw error;
    }
  },
};

export const oxidHttpCategoryAdapter: OxidCatalogAdapter = {
  async searchCategories(): Promise<OxidCategorySearchResult> {
    throw new Error(`OXID category search not implemented yet (base ${env.oxid.apiBaseUrl || "unset"})`);
  },
};

export const oxidHttpDispatchAdapter: DispatchAdapter = {
  type: "oxid",
  async dispatch(target, payload): Promise<DispatchResult> {
    if (!target.endpoint) {
      logger.info("dispatch.oxid.prepared", {
        correlationId: payload.correlationId,
        reference: payload.request.reference,
        body: payload.exportBody,
        reason: "no_endpoint",
      });
      return {
        success: false,
        error: "OXID dispatch endpoint not configured on DispatchTarget — payload prepared but not sent",
        response: { body: payload.exportBody },
      };
    }
    try {
      const { fetchWithTimeout } = await import("@/lib/http");
      const res = await fetchWithTimeout(target.endpoint, {
        method: "POST",
        timeoutMs: 8000,
        headers: {
          "content-type": "application/json",
          "x-correlation-id": payload.correlationId,
          Accept: "application/json",
        },
        body: JSON.stringify(payload.exportBody),
      });
      let upstream: unknown = null;
      try {
        upstream = await res.json();
      } catch {
        upstream = await res.text().catch(() => null);
      }
      return {
        success: res.ok,
        httpStatus: res.status,
        response: { body: payload.exportBody, upstream },
        error: res.ok ? undefined : `HTTP ${res.status}`,
      };
    } catch (error) {
      return {
        success: false,
        error: errorMessage(error),
        response: { body: payload.exportBody },
      };
    }
  },
};
