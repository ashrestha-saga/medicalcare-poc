"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScanHeuteDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";

export function useHeuteList(active: boolean) {
  const [data, setData] = useState<ScanHeuteDTO | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<ScanHeuteDTO>("/api/scan/heute");
      setData(res);
    } catch (e) {
      setData(null);
      toast.error(e instanceof ApiError ? e.message : "Failed to load Heute");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    void reload();
  }, [active, reload]);

  return { data, loading, reload };
}
