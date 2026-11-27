"use client";

import { useCallback, useEffect, useState } from "react";
import type { ShopAccountResponse, ShopDeliveryAddressDTO } from "@/interfaces/shop";
import { api, ApiError } from "@/lib/http/apiClient";

/**
 * Loads shop /me profile (delivery addresses + hasSubUsers) for the order UI.
 */
export function useShopAccount(enabled: boolean) {
  const [account, setAccount] = useState<ShopAccountResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setAccount(null);
      setSelectedAddressId(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api<ShopAccountResponse>("/api/shop/account");
      setAccount(res);
      setSelectedAddressId((prev) => {
        if (prev && res.deliveryAddresses.some((a) => a.id === prev)) return prev;
        return res.deliveryAddresses[0]?.id ?? null;
      });
    } catch (e) {
      setAccount(null);
      setSelectedAddressId(null);
      setError(e instanceof ApiError ? e.message : "Could not load shop addresses.");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedAddress: ShopDeliveryAddressDTO | null =
    account?.deliveryAddresses.find((a) => a.id === selectedAddressId) ?? null;

  return {
    account,
    loading,
    error,
    addresses: account?.deliveryAddresses ?? [],
    selectedAddressId,
    setSelectedAddressId,
    selectedAddress,
    hasSubUsers: account?.hasSubUsers ?? false,
    reload: load,
  };
}
