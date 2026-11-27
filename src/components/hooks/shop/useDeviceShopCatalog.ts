"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DeviceShopCatalogResponse,
  DeviceShopCatalogSectionResponse,
  ShopArticleDTO,
  ShopCatalogSection,
} from "@/interfaces/shop";
import { api, ApiError } from "@/lib/http/apiClient";

type SectionCache = Partial<Record<ShopCatalogSection, ShopArticleDTO[]>>;
type SectionStatus = Partial<Record<ShopCatalogSection, "idle" | "loading" | "ready" | "error">>;

export function useDeviceShopCatalog(deviceInstanceId: string | undefined) {
  const [data, setData] = useState<DeviceShopCatalogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sectionStatus, setSectionStatus] = useState<SectionStatus>({});
  const [sectionError, setSectionError] = useState<Partial<Record<ShopCatalogSection, string>>>({});
  const sectionCache = useRef<SectionCache>({});
  const inFlight = useRef<Partial<Record<ShopCatalogSection, Promise<void>>>>({});

  const load = useCallback(async () => {
    if (!deviceInstanceId) {
      setData(null);
      setError(null);
      sectionCache.current = {};
      setSectionStatus({});
      setSectionError({});
      return;
    }
    setLoading(true);
    setError(null);
    sectionCache.current = {};
    setSectionStatus({});
    setSectionError({});
    try {
      const res = await api<DeviceShopCatalogResponse>(
        `/api/devices/${encodeURIComponent(deviceInstanceId)}/shop-catalog`,
      );
      setData(res);
    } catch (e) {
      setData(null);
      setError(e instanceof ApiError ? e.message : "Could not load shop catalog.");
    } finally {
      setLoading(false);
    }
  }, [deviceInstanceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const ensureSection = useCallback(
    async (section: ShopCatalogSection) => {
      if (!deviceInstanceId) return;
      if (sectionCache.current[section]) {
        setSectionStatus((s) => ({ ...s, [section]: "ready" }));
        return;
      }
      if (inFlight.current[section]) {
        await inFlight.current[section];
        return;
      }

      setSectionStatus((s) => ({ ...s, [section]: "loading" }));
      setSectionError((s) => ({ ...s, [section]: undefined }));

      const run = (async () => {
        try {
          const res = await api<DeviceShopCatalogSectionResponse>(
            `/api/devices/${encodeURIComponent(deviceInstanceId)}/shop-catalog?section=${section}`,
          );
          sectionCache.current[section] = res.items;
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  accessories: section === "accessories" ? res.items : prev.accessories,
                  suggestions: section === "suggestions" ? res.items : prev.suggestions,
                  ...(section === "accessories" ? { accessoryCount: res.items.length } : {}),
                  ...(section === "suggestions" ? { suggestionCount: res.items.length } : {}),
                }
              : prev,
          );
          setSectionStatus((s) => ({ ...s, [section]: "ready" }));
        } catch (e) {
          setSectionStatus((s) => ({ ...s, [section]: "error" }));
          setSectionError((s) => ({
            ...s,
            [section]: e instanceof ApiError ? e.message : "Could not load this tab.",
          }));
        } finally {
          delete inFlight.current[section];
        }
      })();

      inFlight.current[section] = run;
      await run;
    },
    [deviceInstanceId],
  );

  const patchArticle = useCallback((articleId: string, patch: Partial<ShopArticleDTO>) => {
    const apply = (list: ShopArticleDTO[]) =>
      list.map((a) => (a.id === articleId ? { ...a, ...patch } : a));
    if (sectionCache.current.accessories) {
      sectionCache.current.accessories = apply(sectionCache.current.accessories);
    }
    if (sectionCache.current.suggestions) {
      sectionCache.current.suggestions = apply(sectionCache.current.suggestions);
    }
    setData((prev) =>
      prev
        ? {
            ...prev,
            accessories: apply(prev.accessories),
            suggestions: apply(prev.suggestions),
            primary: prev.primary?.id === articleId ? { ...prev.primary, ...patch } : prev.primary,
            variants: apply(prev.variants),
          }
        : prev,
    );
  }, []);

  return {
    data,
    loading,
    error,
    reload: load,
    ensureSection,
    sectionStatus,
    sectionError,
    patchArticle,
  };
}
