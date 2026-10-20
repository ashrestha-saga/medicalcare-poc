"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScanChargeListItemDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";
import { useTranslations } from "next-intl";

export function useChargenList(active: boolean, equipmentDeviceId?: string) {
  const t = useTranslations("scan.chargen");
  const [items, setItems] = useState<ScanChargeListItemDTO[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const q = equipmentDeviceId
        ? `?equipmentDeviceId=${encodeURIComponent(equipmentDeviceId)}`
        : "";
      const res = await api<{ items: ScanChargeListItemDTO[] }>(`/api/scan/chargen${q}`);
      setItems(res.items);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("errLoad"));
    } finally {
      setLoading(false);
    }
  }, [equipmentDeviceId, t]);

  useEffect(() => {
    if (!active) return;
    void reload();
  }, [active, reload]);

  return { items, loading, reload };
}
