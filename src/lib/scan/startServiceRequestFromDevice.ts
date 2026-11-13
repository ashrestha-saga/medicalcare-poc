import type { ResolveResponse } from "@/interfaces";
import { api } from "@/lib/http/apiClient";
import { useRequestStore } from "@/store/requestStore";
import { useScanStore } from "@/store/scanStore";

/**
 * Seed the scan workflow with a known inventory device and advance to the
 * service-request form (no camera / manual resolve step).
 */
export async function startServiceRequestFromDevice(input: {
  inventoryNumber: string;
}): Promise<void> {
  const raw = input.inventoryNumber.trim();
  if (!raw) throw new Error("Inventory number is required.");

  const scan = useScanStore.getState();
  const request = useRequestStore.getState();

  scan.reset();
  scan.startResolving(raw);

  try {
    const result = await api<ResolveResponse>("/api/resolve", {
      method: "POST",
      body: JSON.stringify({ raw, context: "service" }),
    });

    request.resetForm();
    if (result.device?.location) {
      request.prefillLocation({
        siteId: result.device.location.siteId,
        areaId: result.device.location.areaId,
        room: result.device.location.room,
      });
    }

    scan.resolved(result);

    if (!result.device) {
      // Model/candidates/capture — leave user on the normal post-resolve screen.
      return;
    }

    useScanStore.getState().continueToServiceRequest();
  } catch (err) {
    useScanStore.getState().resolveFailed(
      err instanceof Error ? err.message : "Resolve failed",
    );
    throw err;
  }
}
