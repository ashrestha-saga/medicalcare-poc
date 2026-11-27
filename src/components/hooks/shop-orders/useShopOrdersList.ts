"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OrderRequestDTO, ShopOrdersListResponse, ShopOrdersSummaryDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { useQueryParam, useSyncQueryParams } from "@/lib/navigation/searchParams";

export type ShopOrdersFilter = "all" | "ordered" | "shipped" | "failed";

const FILTERS: ShopOrdersFilter[] = ["all", "ordered", "shipped", "failed"];

const EMPTY_SUMMARY: ShopOrdersSummaryDTO = {
  total: 0,
  ordered: 0,
  submitting: 0,
  intent: 0,
  shipped: 0,
  failed: 0,
  other: 0,
};

function parseFilter(raw: string | null): ShopOrdersFilter {
  if (raw && FILTERS.includes(raw as ShopOrdersFilter)) return raw as ShopOrdersFilter;
  return "all";
}

function matchesFilter(order: OrderRequestDTO, filter: ShopOrdersFilter): boolean {
  if (filter === "all") return true;
  const state = order.externalState ?? "intent";
  if (filter === "ordered") return state === "ordered";
  if (filter === "shipped") return state === "shipped";
  // failed card buckets failed / cancelled / expired (same as server summary)
  return state === "failed" || state === "cancelled" || state === "expired";
}

export function useShopOrdersList() {
  const { sync } = useSyncQueryParams();
  const filterParam = useQueryParam("filter");

  const [orders, setOrders] = useState<OrderRequestDTO[]>([]);
  const [summary, setSummary] = useState<ShopOrdersSummaryDTO>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilterState] = useState<ShopOrdersFilter>(() => parseFilter(filterParam));

  useEffect(() => {
    setFilterState(parseFilter(filterParam));
  }, [filterParam]);

  const setFilter = useCallback(
    (next: ShopOrdersFilter) => {
      setFilterState(next);
      sync({ filter: next === "all" ? null : next });
    },
    [sync],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<ShopOrdersListResponse>("/api/shop-orders");
      setOrders(res.orders);
      setSummary(res.summary);
    } catch (e) {
      setOrders([]);
      setSummary(EMPTY_SUMMARY);
      setError(e instanceof ApiError ? e.message : "Could not load shop orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredOrders = useMemo(
    () => orders.filter((o) => matchesFilter(o, filter)),
    [orders, filter],
  );

  return {
    orders: filteredOrders,
    summary,
    loading,
    error,
    reload: load,
    filter,
    setFilter,
  };
}
