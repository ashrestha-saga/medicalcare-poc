"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DeviceInstanceDetailDTO, DeviceInstanceDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { inspectionTagsFromFlags } from "@/lib/inspectionTags";
import { useResolve } from "@/components/hooks/scan/useResolve";
import { useCapturerInventoryUi } from "@/store/capturerInventoryStore";
import { toast } from "@/store/toastStore";

function collectRooms(devices: DeviceInstanceDTO[]): string[] {
  const set = new Set<string>();
  for (const d of devices) {
    const room = d.location?.room?.trim();
    if (room) set.add(room);
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** Capturer home inventory browse — list + optional detail (no admin chrome). */
export function useCapturerInventory(enabled = true) {
  const [devices, setDevices] = useState<DeviceInstanceDTO[]>([]);
  const [q, setQ] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [room, setRoomState] = useState("");
  const [rooms, setRooms] = useState<string[]>([]);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [selected, setSelected] = useState<DeviceInstanceDetailDTO | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [requestingService, setRequestingService] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roomRef = useRef(room);
  const { resolve } = useResolve();
  const closePanel = useCapturerInventoryUi((s) => s.closePanel);

  const refresh = useCallback(
    async (search = q, roomFilter = roomRef.current) => {
      if (!enabled) {
        setDevices([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("q", search.trim());
        if (roomFilter.trim()) params.set("room", roomFilter.trim());
        const qs = params.toString() ? `?${params.toString()}` : "";
        const res = await api<{ devices: DeviceInstanceDTO[] }>(`/api/devices${qs}`);
        setDevices(res.devices);
        if (!roomFilter.trim()) {
          setRooms(collectRooms(res.devices));
        }
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not load inventory.");
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
        void refresh(value, roomRef.current);
      }, 280);
    },
    [refresh],
  );

  const setRoom = useCallback(
    (value: string) => {
      setRoomState(value);
      roomRef.current = value;
      void refresh(q, value);
    },
    [refresh, q],
  );

  const openDevice = useCallback(async (device: DeviceInstanceDTO) => {
    setDetailLoading(true);
    try {
      const res = await api<{ device: DeviceInstanceDetailDTO }>(`/api/devices/${device.id}`);
      setSelected(res.device);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load device.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => setSelected(null), []);

  /** Close inventory overlay and enter the normal scan → service-request flow. */
  const requestService = useCallback(
    async (device: DeviceInstanceDetailDTO) => {
      const inv = device.inventoryNumber?.trim();
      if (!inv || requestingService) return;
      setRequestingService(true);
      try {
        closePanel();
        await resolve(inv, "manual");
      } finally {
        setRequestingService(false);
      }
    },
    [closePanel, resolve, requestingService],
  );

  return {
    devices,
    loading,
    keywordInput,
    setKeyword,
    room,
    setRoom,
    rooms,
    selected,
    detailLoading,
    requestingService,
    openDevice,
    closeDetail,
    requestService,
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
