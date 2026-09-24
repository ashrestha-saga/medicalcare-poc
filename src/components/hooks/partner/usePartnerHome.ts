"use client";

import { useCallback, useEffect, useState } from "react";
import type { PartnerHomeDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";

export function usePartnerHome() {
  const [data, setData] = useState<PartnerHomeDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const home = await api<PartnerHomeDTO>("/api/partner/home");
      setData(home);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load partner home");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, error, loading, refresh };
}
