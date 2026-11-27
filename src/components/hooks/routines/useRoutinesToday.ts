"use client";

import { useCallback, useEffect, useState } from "react";
import type { RoutineDueDeviceDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";

/** Open IFU routines for the current cadence window (E105 tile destination). */
export function useRoutinesToday() {
  const [items, setItems] = useState<RoutineDueDeviceDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ items: RoutineDueDeviceDTO[]; count: number }>(
        "/api/routine-checks/open-today",
      );
      setItems(res.items);
      setDisabled(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setDisabled(true);
        setItems([]);
      } else {
        toast.error(err instanceof ApiError ? err.message : "Could not load routines.");
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, disabled, refresh };
}
