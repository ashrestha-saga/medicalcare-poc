"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrderRequestDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";

export function useShopOrderDetail(reference: string) {
  const [order, setOrder] = useState<OrderRequestDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!reference) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ order: OrderRequestDTO }>(
        `/api/shop-orders/${encodeURIComponent(reference)}`,
      );
      setOrder(res.order);
    } catch (e) {
      setOrder(null);
      setError(e instanceof ApiError ? e.message : "Could not load shop order.");
    } finally {
      setLoading(false);
    }
  }, [reference]);

  useEffect(() => {
    void load();
  }, [load]);

  return { order, loading, error, reload: load };
}
