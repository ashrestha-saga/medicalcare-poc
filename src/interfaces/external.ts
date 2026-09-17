/**
 * Raw external response shapes for OXID / BEUDAMED adapters.
 * Keep mappers next to adapters; UI must not import this file.
 */

/** Opaque BEUDAMED payload — prefer OpenAPI `EudamedDevice` / `FdaUdi` flat fields. */
export interface BeudamedRawResponse {
  [key: string]: unknown;
}

export interface OxidCategoryRaw {
  [key: string]: unknown;
}

export interface OxidCategorySearchResult {
  query: string;
  categories: { id: string; name: string; path: string[] }[];
  articles: {
    id: string;
    articleNumber: string;
    title: string;
    manufacturer: string | null;
    gtin: string | null;
    price: number | null;
    currency: string;
    categoryId: string | null;
  }[];
  fetchedAt: string;
  source: "oxid-mock" | "oxid";
}

export interface OxidTokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
  tokenType: string;
}

/** Subset of Merzljak `OAuthMeResponse.data`. */
/** Merzljak OXID `/oauth/me` `data` object (v1.5+). */
export interface OxidMeProfile {
  /** OXID user id (primary identity field from the shop). */
  oxid: string;
  /** Optional OpenID-style alias some IdPs may still send. */
  sub?: string;
  email?: string;
  salutation?: string;
  first_name?: string;
  last_name?: string;
  custnr?: string;
  company?: string;
  street?: string;
  street_no?: string;
  zip?: string;
  city?: string;
  billing?: {
    company?: string;
    street?: string;
    street_no?: string;
    zip?: string;
    city?: string;
  };
  addresses?: Array<{
    oxid?: string;
    company?: string;
    street?: string;
    street_no?: string;
    zip?: string;
    city?: string;
  }>;
}
