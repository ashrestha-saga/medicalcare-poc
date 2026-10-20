"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComposedBookDeviceOptionDTO, ComposedBookDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { useQueryParam, useSyncQueryParams } from "@/lib/navigation/searchParams";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

function matchesSearch(d: ComposedBookDeviceOptionDTO, q: string): boolean {
  if (!q) return true;
  const hay = [
    d.inventoryNumber,
    d.name,
    d.manufacturer,
    d.modelName,
    d.serialNumber,
    d.basicUdiDi,
    d.udiDi,
    d.gtins,
    d.areaName,
    d.siteName,
    d.room,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function useDeviceBookComposed() {
  const { checkPermission } = usePermissions();
  const canView = checkPermission("devicebook:view");
  const canUploadIfu = checkPermission("inventory:update");
  const deviceParam = useQueryParam("device");
  const qParam = useQueryParam("q");
  const { sync } = useSyncQueryParams();

  const [devices, setDevices] = useState<ComposedBookDeviceOptionDTO[]>([]);
  const [book, setBook] = useState<ComposedBookDTO | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [bookLoading, setBookLoading] = useState(false);
  const [search, setSearchState] = useState(() => qParam ?? "");

  const setDevice = useCallback(
    (id: string | null) => {
      sync({ device: id });
    },
    [sync],
  );

  const setSearch = useCallback(
    (value: string) => {
      setSearchState(value);
      sync({ q: value.trim() || null });
    },
    [sync],
  );

  const filteredDevices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return devices.filter((d) => matchesSearch(d, q));
  }, [devices, search]);

  const refreshList = useCallback(async () => {
    if (!canView) {
      setDevices([]);
      setListLoading(false);
      return;
    }
    setListLoading(true);
    try {
      const list = await api<{ devices: ComposedBookDeviceOptionDTO[] }>(
        "/api/device-book/composed",
      );
      setDevices(list.devices);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load device book.");
      setDevices([]);
    } finally {
      setListLoading(false);
    }
  }, [canView]);

  const refreshBook = useCallback(async () => {
    if (!canView || !deviceParam) {
      setBook(null);
      setBookLoading(false);
      return;
    }
    setBookLoading(true);
    try {
      const res = await api<{ book: ComposedBookDTO }>(
        `/api/device-book/composed?deviceInstanceId=${encodeURIComponent(deviceParam)}`,
      );
      setBook(res.book);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load device book.");
      setBook(null);
    } finally {
      setBookLoading(false);
    }
  }, [canView, deviceParam]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    void refreshBook();
  }, [refreshBook]);

  async function uploadIfu(input: {
    deviceInstanceId: string;
    dataUrl?: string | null;
    externalRecordRef?: string | null;
  }) {
    try {
      await api("/api/device-book/ifu", {
        method: "POST",
        body: JSON.stringify(input),
      });
      toast.success("IFU saved.");
      await Promise.all([refreshList(), refreshBook()]);
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not upload IFU.");
      return false;
    }
  }

  return {
    canView,
    canUploadIfu,
    devices,
    filteredDevices,
    book,
    listLoading,
    bookLoading,
    loading: listLoading || bookLoading,
    deviceId: deviceParam,
    search,
    setSearch,
    setDevice,
    refresh: async () => {
      await refreshList();
      await refreshBook();
    },
    uploadIfu,
  };
}
