"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConsoleClinicListDTO } from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";

export function useCustomerList() {
  const [data, setData] = useState<ConsoleClinicListDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api<ConsoleClinicListDTO>("/api/partner/clinics");
      setData(list);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, error, loading, refresh };
}
