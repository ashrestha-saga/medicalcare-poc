"use client";

import { useCallback, useEffect, useState } from "react";
import type { OxidAuthorizeResponse, OxidConnectionStatus } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";

export function oxidStatusLabel(status: OxidConnectionStatus["status"]): string {
  if (status === "connected") return "Connected";
  if (status === "error") return "Error";
  return "Disconnected";
}

/**
 * Loads and mutates the clinic OXID shop connection (settings).
 */
export function useOxidSettings() {
  const [status, setStatus] = useState<OxidConnectionStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api<OxidConnectionStatus>("/api/settings/oxid");
      setStatus(s);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not load settings.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial settings fetch + OAuth query toasts
    void load();
    const oxid = new URLSearchParams(window.location.search).get("oxid");
    if (oxid === "connected") toast.success("OXID shop linked for this clinic.");
    if (oxid === "failed" || oxid === "denied" || oxid === "invalid") {
      toast.error("OXID linking failed or was cancelled.");
    }
    if (oxid) {
      window.history.replaceState(null, "", "/settings");
    }
  }, [load]);

  const connect = useCallback(async () => {
    setBusy(true);
    try {
      const res = await api<OxidAuthorizeResponse>("/api/settings/oxid", { method: "POST", body: "{}" });
      window.location.assign(res.authorizeUrl);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not start OXID connect.");
      setBusy(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setBusy(true);
    try {
      const s = await api<OxidConnectionStatus>("/api/settings/oxid", { method: "DELETE" });
      setStatus(s);
      toast.success("OXID shop disconnected.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Disconnect failed.");
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, busy, connect, disconnect, reload: load };
}
