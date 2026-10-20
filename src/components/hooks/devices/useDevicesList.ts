"use client";

import { useCallback, useEffect, useState } from "react";
import type { DeviceInstanceDetailDTO, DeviceInstanceDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { useQueryParam, useSyncQueryParams } from "@/lib/navigation/searchParams";
import { toast } from "@/store/toastStore";

export type DeviceStateFilter = "draft" | "review" | "released" | "retired" | "not_released" | null;

function parseState(raw: string | null): DeviceStateFilter {
  if (
    raw === "draft" ||
    raw === "review" ||
    raw === "released" ||
    raw === "retired" ||
    raw === "not_released"
  ) {
    return raw;
  }
  return null;
}

function buildListQuery(opts: {
  q: string;
  siteId: string | null;
  state: DeviceStateFilter;
  mineArea: boolean;
}): string {
  const sp = new URLSearchParams();
  if (opts.q.trim()) sp.set("q", opts.q.trim());
  if (opts.siteId) sp.set("siteId", opts.siteId);
  if (opts.state) sp.set("state", opts.state);
  if (opts.mineArea) sp.set("mineArea", "1");
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export function useDevicesList() {
  const { checkPermission } = usePermissions();
  const canView = checkPermission("inventory:view");
  const canUpdate = checkPermission("inventory:update");
  const { sync } = useSyncQueryParams();

  const qParam = useQueryParam("q");
  const stateParam = useQueryParam("state");
  const siteParam = useQueryParam("siteId");
  const mineAreaParam = useQueryParam("mineArea");

  const [devices, setDevices] = useState<DeviceInstanceDTO[]>([]);
  const [q, setQState] = useState(qParam ?? "");
  const [stateFilter, setStateFilterState] = useState<DeviceStateFilter>(() => parseState(stateParam));
  const [siteFilter, setSiteFilterState] = useState<string | null>(siteParam);
  const [mineArea, setMineAreaState] = useState(mineAreaParam === "1");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DeviceInstanceDetailDTO | DeviceInstanceDTO | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    setQState(qParam ?? "");
    setStateFilterState(parseState(stateParam));
    setSiteFilterState(siteParam);
    setMineAreaState(mineAreaParam === "1");
  }, [qParam, stateParam, siteParam, mineAreaParam]);

  const setQ = useCallback(
    (value: string) => {
      setQState(value);
      sync({ q: value.trim() || null });
    },
    [sync],
  );

  const setStateFilter = useCallback(
    (value: DeviceStateFilter) => {
      setStateFilterState(value);
      sync({ state: value });
    },
    [sync],
  );

  const setSiteFilter = useCallback(
    (value: string | null) => {
      setSiteFilterState(value);
      sync({ siteId: value });
    },
    [sync],
  );

  const setMineArea = useCallback(
    (value: boolean) => {
      setMineAreaState(value);
      sync({ mineArea: value ? "1" : null });
    },
    [sync],
  );

  const clearListFilters = useCallback(() => {
    setStateFilterState(null);
    setSiteFilterState(null);
    setMineAreaState(false);
    sync({ state: null, siteId: null, mineArea: null });
  }, [sync]);

  const refresh = useCallback(
    async (override?: {
      q?: string;
      siteId?: string | null;
      state?: DeviceStateFilter;
      mineArea?: boolean;
    }) => {
      if (!canView) {
        setDevices([]);
        setLoading(false);
        return;
      }
      const nextQ = override?.q ?? q;
      const nextSite = override?.siteId !== undefined ? override.siteId : siteFilter;
      const nextState = override?.state !== undefined ? override.state : stateFilter;
      const nextMine = override?.mineArea !== undefined ? override.mineArea : mineArea;
      setLoading(true);
      try {
        const qs = buildListQuery({
          q: nextQ,
          siteId: nextSite,
          state: nextState,
          mineArea: nextMine,
        });
        const res = await api<{ devices: DeviceInstanceDTO[] }>(`/api/devices${qs}`);
        setDevices(res.devices);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not load inventory.");
        setDevices([]);
      } finally {
        setLoading(false);
      }
    },
    [canView, q, siteFilter, stateFilter, mineArea],
  );

  useEffect(() => {
    void refresh({
      q: qParam ?? "",
      siteId: siteParam,
      state: parseState(stateParam),
      mineArea: mineAreaParam === "1",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when URL filters change
  }, [canView, qParam, stateParam, siteParam, mineAreaParam]);

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

  const [completingDutyId, setCompletingDutyId] = useState<string | null>(null);

  const completeDuty = useCallback(
    async (dutyId: string) => {
      setCompletingDutyId(dutyId);
      try {
        const res = await api<{ device: DeviceInstanceDetailDTO }>(`/api/duties/${dutyId}/complete`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        toast.success("Duty marked done; next due date updated.");
        applyUpdated(res.device);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not complete duty.");
      } finally {
        setCompletingDutyId(null);
      }
    },
    [applyUpdated],
  );

  return {
    devices,
    q,
    setQ,
    stateFilter,
    setStateFilter,
    siteFilter,
    setSiteFilter,
    mineArea,
    setMineArea,
    clearListFilters,
    loading,
    refresh,
    canView,
    canUpdate,
    selected,
    selectDevice,
    clearSelection: () => setSelected(null),
    detailLoading,
    applyUpdated,
    completingDutyId,
    completeDuty,
  };
}
