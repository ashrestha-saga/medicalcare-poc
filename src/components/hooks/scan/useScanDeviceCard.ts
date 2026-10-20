"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScanDeviceCardDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";

export function useScanDeviceCard(deviceId: string | null) {
  const [card, setCard] = useState<ScanDeviceCardDTO | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!deviceId) {
      setCard(null);
      return;
    }
    setLoading(true);
    try {
      const res = await api<{ card: ScanDeviceCardDTO }>(`/api/scan/devices/${deviceId}`);
      setCard(res.card);
    } catch (e) {
      setCard(null);
      toast.error(e instanceof ApiError ? e.message : "Could not load device");
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { card, loading, reload };
}
