"use client";

import { useEffect, useState } from "react";
import type { PartsSearchResponse, PartsSearchResult, SparePartDTO } from "@/interfaces";
import { api } from "@/lib/http/apiClient";

/**
 * OXID category / spare-parts search keyed by query + optional model.
 */
export function usePartsSearch(query: string, modelId?: string) {
  const searchKey = `${query}\u0000${modelId ?? ""}`;
  const [result, setResult] = useState<PartsSearchResult | null>(null);
  const loading = result?.key !== searchKey;
  const parts: SparePartDTO[] = result?.parts ?? [];
  const source = result?.source ?? null;

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams({ q: query });
    if (modelId) params.set("modelId", modelId);
    api<PartsSearchResponse>(`/api/oxid/categories?${params}`)
      .then((r) => alive && setResult({ key: searchKey, parts: r.parts, source: r.source }))
      .catch(() => alive && setResult({ key: searchKey, parts: [], source: null }));
    return () => {
      alive = false;
    };
  }, [query, modelId, searchKey]);

  return { parts, source, loading, searchKey };
}
