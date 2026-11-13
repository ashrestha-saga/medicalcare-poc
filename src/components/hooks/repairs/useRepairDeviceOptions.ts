"use client";

import { useEffect, useState } from "react";
import type { DeviceInstanceDTO } from "@/interfaces";
import { api } from "@/lib/apiClient";

export type RepairDeviceOption = {
  id: string;
  label: string;
};

function toLabel(d: DeviceInstanceDTO): string {
  const name = d.tradeName?.trim() || d.modelName?.trim() || "—";
  const place = [d.location?.siteName, d.location?.areaName, d.location?.room]
    .filter(Boolean)
    .join(" · ");
  return place ? `${d.inventoryNumber} · ${name} · ${place}` : `${d.inventoryNumber} · ${name}`;
}

/** Lightweight inventory options for repair clinic forms (select by device). */
export function useRepairDeviceOptions() {
  const [options, setOptions] = useState<RepairDeviceOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await api<{ devices: DeviceInstanceDTO[] }>("/api/devices?state=released");
        if (cancelled) return;
        setOptions(
          res.devices
            .map((d) => ({ id: d.id, label: toLabel(d) }))
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" })),
        );
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { options, loading };
}
