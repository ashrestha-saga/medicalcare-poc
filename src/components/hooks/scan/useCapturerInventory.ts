"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DeviceInstanceDetailDTO, DeviceInstanceDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { inspectionTagsFromFlags } from "@/lib/inspectionTags";
import { toast } from "@/store/toastStore";

/** Capturer home inventory browse — list + optional detail (no admin chrome). */
export function useCapturerInventory(enabled = true) {
  const [devices, setDevices] = useState<DeviceInstanceDTO[]>([]);
  const [q, setQ] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [loading, setLoading] = useState(Boolean(enabled));
  const [selected, setSelected] = useState<DeviceInstanceDetailDTO | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(
    async (search = q) => {
      if (!enabled) {
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
        toast.error(err instanceof ApiError ? err.message : "Bestand konnte nicht geladen werden.");
        setDevices([]);
      } finally {
        setLoading(false);
      }
    },
    [enabled, q],
  );

  useEffect(() => {
    if (!enabled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount fetch
    void refresh("");
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount / enabled fetch
  }, [enabled]);

  const setKeyword = useCallback(
    (value: string) => {
      setKeywordInput(value);
      setQ(value);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => {
        void refresh(value);
      }, 280);
    },
    [refresh],
  );

  const openDevice = useCallback(async (device: DeviceInstanceDTO) => {
    setDetailLoading(true);
    try {
      const res = await api<{ device: DeviceInstanceDetailDTO }>(`/api/devices/${device.id}`);
      setSelected(res.device);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gerät konnte nicht geladen werden.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => setSelected(null), []);

  return {
    devices,
    loading,
    keywordInput,
    setKeyword,
    selected,
    detailLoading,
    openDevice,
    closeDetail,
    refresh,
  };
}

export function deviceDisplayName(device: DeviceInstanceDTO | DeviceInstanceDetailDTO): string {
  return device.tradeName ?? device.modelName ?? device.inventoryNumber;
}

export function deviceLocationLine(device: DeviceInstanceDTO | DeviceInstanceDetailDTO): string {
  const loc = device.location;
  if (!loc) return device.inventoryNumber;
  const parts = [loc.areaName, loc.room ? `Raum ${loc.room}` : null].filter(Boolean);
  if (parts.length) return `${device.inventoryNumber} · ${parts.join(" · ")}`;
  return `${device.inventoryNumber}${loc.text ? ` · ${loc.text}` : ""}`;
}

export function deviceInspectionTags(
  device: DeviceInstanceDTO | DeviceInstanceDetailDTO,
): string[] {
  if (device.inspectionTags?.length) return device.inspectionTags;
  if ("modelClassification" in device && device.modelClassification) {
    return inspectionTagsFromFlags(device.modelClassification);
  }
  return inspectionTagsFromFlags(device.classification);
}
