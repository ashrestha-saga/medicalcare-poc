"use client";

import { useCallback, useState } from "react";
import type { ResolveResponse } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { useRequestStore } from "@/store/requestStore";
import { useScanStore } from "@/store/scanStore";
import { toast } from "@/store/toastStore";

/** Select or skip after GTIN inventory-candidates resolve. */
export function useInventoryCandidates() {
  const resolution = useScanStore((s) => s.resolution);
  const resolved = useScanStore((s) => s.resolved);
  const reset = useScanStore((s) => s.reset);
  const lastRaw = useScanStore((s) => s.lastRaw);
  const prefillLocation = useRequestStore((s) => s.prefillLocation);
  const [selecting, setSelecting] = useState(false);
  const [selectError, setSelectError] = useState<string | null>(null);

  const selectDevice = useCallback(
    async (deviceId: string) => {
      if (selecting) return;
      setSelecting(true);
      setSelectError(null);
      try {
        const result = await api<ResolveResponse>("/api/resolve/select", {
          method: "POST",
          body: JSON.stringify({
            deviceId,
            correlationId: resolution?.correlationId,
            raw: lastRaw ?? resolution?.identifier.raw,
          }),
        });
        if (result.device?.location) {
          prefillLocation({
            siteId: result.device.location.siteId,
            areaId: result.device.location.areaId,
            room: result.device.location.room,
          });
        }
        resolved(result);
      } catch (e) {
        const message = e instanceof ApiError ? e.message : "Could not select device.";
        setSelectError(message);
        toast.error(message);
      } finally {
        setSelecting(false);
      }
    },
    [selecting, resolution?.correlationId, resolution?.identifier.raw, lastRaw, prefillLocation, resolved],
  );

  const skipCandidates = useCallback(() => {
    const fallback = resolution?.continueWithoutSelection;
    if (!fallback) {
      reset();
      return;
    }
    resolved(fallback);
  }, [resolution?.continueWithoutSelection, resolved, reset]);

  return {
    selecting,
    selectError,
    selectDevice,
    skipCandidates,
    reset,
  };
}
