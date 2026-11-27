"use client";

import { useCallback, useEffect, useState } from "react";
import type { DeviceShopArticlesResponse, ShopArticleDTO } from "@/interfaces/shop";
import type { SparePartDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";

function toSparePart(article: ShopArticleDTO): SparePartDTO {
  return {
    id: article.id,
    articleNumber: article.articleNumber,
    description: article.title,
    manufacturer: article.manufacturer,
    unitPrice: article.unitPrice,
    currency: article.currency,
    fitsModelIds: [],
    category: article.kind === "device" ? "device" : "accessory",
  };
}

/**
 * Loads shop device article + accessories for an inventory device instance.
 */
export function useDeviceShopArticles(deviceInstanceId: string | undefined, enabled: boolean) {
  const [data, setData] = useState<DeviceShopArticlesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!deviceInstanceId || !enabled) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api<DeviceShopArticlesResponse>(
        `/api/devices/${encodeURIComponent(deviceInstanceId)}/shop-articles`,
      );
      setData(res);
    } catch (e) {
      setData(null);
      setError(e instanceof ApiError ? e.message : "Could not load shop articles.");
    } finally {
      setLoading(false);
    }
  }, [deviceInstanceId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const shopParts: SparePartDTO[] = [];
  if (data?.device) shopParts.push(toSparePart(data.device));
  for (const a of data?.accessories ?? []) shopParts.push(toSparePart(a));

  return {
    loading,
    error,
    hasSubUsers: data?.hasSubUsers ?? false,
    source: data?.source ?? null,
    shopParts,
    reload: load,
  };
}
