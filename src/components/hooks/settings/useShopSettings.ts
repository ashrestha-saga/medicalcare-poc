"use client";

import { useCallback, useEffect, useState } from "react";
import type { ShopAuthorizeResponse, ShopConnectionStatus } from "@/interfaces/shop";
import { DEFAULT_SHOP_SCOPE } from "@/schemas/shop";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";

export function shopStatusLabel(status: ShopConnectionStatus["status"]): string {
  if (status === "connected") return "Connected";
  if (status === "error") return "Error";
  return "Disconnected";
}

export type ShopSettingsForm = {
  shopBaseUrl: string;
  clientId: string;
  clientSecret: string;
  scope: string;
};

/**
 * Loads and mutates the clinic shop connection (Settings → shop panel).
 */
export function useShopSettings() {
  const [status, setStatus] = useState<ShopConnectionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<ShopSettingsForm>({
    shopBaseUrl: "",
    clientId: "",
    clientSecret: "",
    scope: DEFAULT_SHOP_SCOPE,
  });

  const load = useCallback(async () => {
    try {
      const s = await api<ShopConnectionStatus>("/api/settings/shop");
      setStatus(s);
      setForm((prev) => ({
        shopBaseUrl: s.shopBaseUrl ?? "",
        clientId: s.clientId ?? "",
        clientSecret: "",
        scope: s.scope ?? DEFAULT_SHOP_SCOPE,
      }));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not load shop settings.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial settings fetch + OAuth query toasts
    void load();
    const oxid = new URLSearchParams(window.location.search).get("oxid");
    if (oxid === "connected") toast.success("Shop linked for this clinic.");
    if (oxid === "failed" || oxid === "denied" || oxid === "invalid") {
      toast.error("Shop linking failed or was cancelled.");
    }
    if (oxid) {
      window.history.replaceState(null, "", "/settings");
    }
  }, [load]);

  const saveConfig = useCallback(async () => {
    setBusy(true);
    try {
      const body: Record<string, string> = {
        provider: "oxid",
        shopBaseUrl: form.shopBaseUrl.trim(),
        clientId: form.clientId.trim(),
        scope: form.scope.trim() || DEFAULT_SHOP_SCOPE,
      };
      if (form.clientSecret.trim()) body.clientSecret = form.clientSecret.trim();
      const s = await api<ShopConnectionStatus>("/api/settings/shop", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setStatus(s);
      setForm((prev) => ({ ...prev, clientSecret: "" }));
      toast.info("Shop settings saved. Connect the shop again to use the new credentials.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save shop settings.");
    } finally {
      setBusy(false);
    }
  }, [form]);

  const connect = useCallback(async () => {
    setBusy(true);
    try {
      const res = await api<ShopAuthorizeResponse>("/api/settings/shop/connect", {
        method: "POST",
        body: JSON.stringify({ returnTo: "/settings" }),
      });
      window.location.assign(res.authorizeUrl);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not start shop connect.");
      setBusy(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setBusy(true);
    try {
      const s = await api<ShopConnectionStatus>("/api/settings/shop", { method: "DELETE" });
      setStatus(s);
      toast.success("Shop disconnected.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Disconnect failed.");
    } finally {
      setBusy(false);
    }
  }, []);

  const patchForm = useCallback((patch: Partial<ShopSettingsForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  return { status, busy, form, patchForm, saveConfig, connect, disconnect, reload: load };
}
