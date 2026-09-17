"use client";

import { useCallback, useEffect, useState } from "react";
import type { DeviceInstanceDetailDTO, DeviceInstanceDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

export function useDevicesList() {
  const { checkPermission } = usePermissions();
  const canView = checkPermission("inventory:view");
  const canUpdate = checkPermission("inventory:update");

  const [devices, setDevices] = useState<DeviceInstanceDTO[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DeviceInstanceDetailDTO | DeviceInstanceDTO | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const refresh = useCallback(
    async (search = q) => {
      if (!canView) {
        setDevices([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const qs = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
        const res = await api<{ devices: DeviceInstanceDTO[] }>(`/api/devices${qs}`);
        setDevices(res.devices);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not load inventory.");
        setDevices([]);
      } finally {
        setLoading(false);
      }
    },
    [canView, q],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount / canView change
    void refresh("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount / gate fetch
  }, [canView]);

  const selectDevice = useCallback(async (device: DeviceInstanceDTO) => {
    setDetailLoading(true);
    setSelected(device);
    try {
      const res = await api<{ device: DeviceInstanceDetailDTO }>(`/api/devices/${device.id}`);
      setSelected(res.device);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load device.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const applyUpdated = useCallback((device: DeviceInstanceDetailDTO) => {
    setSelected(device);
    setDevices((prev) => prev.map((d) => (d.id === device.id ? device : d)));
  }, []);

  return {
    devices,
    q,
    setQ,
    loading,
    refresh,
    canView,
    canUpdate,
    selected,
    selectDevice,
    clearSelection: () => setSelected(null),
    detailLoading,
    applyUpdated,
  };
}
