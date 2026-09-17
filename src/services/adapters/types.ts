import type { DeviceModelDTO, ParsedIdentifier } from "@/interfaces";
import type { OxidCategorySearchResult } from "@/interfaces/external";

/**
 * Adapter boundaries — Sections 18 and 27.
 * Route handlers, components and stores never import a concrete adapter;
 * they only ever see these interfaces via the services.
 */

/** Stage 2 support: article/category master lookup by identifier. */
export interface CatalogSearchHit {
  model: DeviceModelDTO;
  /** Raw shop article row — stored in ExternalSourceRecord, never returned to the client. */
  raw?: unknown;
}

export interface CatalogSearchAdapter {
  readonly name: string;
  search(
    identifier: ParsedIdentifier,
    ctx?: { userId?: string; tenantId?: string },
  ): Promise<CatalogSearchHit | null>;
}

/** OXID product/category search used by the spare-parts flow. */
export interface OxidCatalogAdapter {
  searchCategories(input: { query: string; tenantId: string; modelId?: string }): Promise<OxidCategorySearchResult>;
}

/** Stage 3: external device master (BEUDAMED). */
export interface BeudamedRawLookup {
  /** Returns the raw external payload or null when the identifier is unknown upstream. */
  lookup(udiDi: string, signal: AbortSignal): Promise<{ status: number; payload: unknown } | null>;
}
