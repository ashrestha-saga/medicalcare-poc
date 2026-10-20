"use client";

import { useCallback, useEffect, useState } from "react";
import type { DeviceBookEntryDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

export function useDeviceBookList() {
  const { checkPermission } = usePermissions();
  const canView = checkPermission("devicebook:view");
  const [entries, setEntries] = useState<DeviceBookEntryDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!canView) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api<{ entries: DeviceBookEntryDTO[] }>("/api/device-book");
      setEntries(res.entries);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load device book.");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { canView, entries, loading, refresh };
}
