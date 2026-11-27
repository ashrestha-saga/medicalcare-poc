"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { scanResumePath, shopPathForDevice } from "@/lib/scan/shopNavigation";
import { useScanStore } from "@/store/scanStore";

/**
 * Inventory devices → dedicated /shop (accessories + suggestions).
 * Catalog / non-inventory → legacy in-scan PartsScreen.
 */
export function useOpenSpareParts() {
  const router = useRouter();
  const openParts = useScanStore((s) => s.openParts);
  const resolution = useScanStore((s) => s.resolution);
  const captured = useScanStore((s) => s.captured);

  return useCallback(() => {
    if (captured) return;
    const deviceId = resolution?.device?.id?.trim();
    if (resolution?.stage === "inventory" && deviceId) {
      router.push(shopPathForDevice(deviceId, scanResumePath(deviceId), { tab: "accessories" }));
      return;
    }
    openParts();
  }, [captured, openParts, resolution?.device?.id, resolution?.stage, router]);
}
