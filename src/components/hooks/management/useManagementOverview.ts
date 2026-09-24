"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ManagementOverviewDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";

export function useManagementOverview() {
  const t = useTranslations("pages.management");
  const [data, setData] = useState<ManagementOverviewDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const overview = await api<ManagementOverviewDTO>("/api/management");
      setData(overview);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, error, loading, refresh };
}
