"use client";

import { useEffect } from "react";
import { useCapturerInventory } from "@/components/hooks/scan/useCapturerInventory";
import { CapturerInventoryList } from "@/components/features/scan/CapturerInventoryList";
import { CapturerDeviceRecord } from "@/components/features/scan/CapturerDeviceRecord";
import { useCapturerInventoryUi } from "@/store/capturerInventoryStore";

/**
 * Full-panel inventory register — account-bar overlay or Scan Bestand tab (`embedded`).
 * When `onOpenDevice` is set (Scan shell), Open opens the Scan device card instead of
 * the legacy CapturerDeviceRecord detail.
 */
export function CapturerInventoryPanel({
  embedded = false,
  onCloseTab,
  onOpenDevice,
}: {
  embedded?: boolean;
  onCloseTab?: () => void;
  /** Prefer Scan device card (gated MORE actions) over CapturerDeviceRecord. */
  onOpenDevice?: (deviceId: string) => void;
}) {
  const storeOpen = useCapturerInventoryUi((s) => s.open);
  const closePanel = useCapturerInventoryUi((s) => s.closePanel);
  const setCount = useCapturerInventoryUi((s) => s.setCount);
  const open = embedded || storeOpen;
  const inventory = useCapturerInventory(open);
  const useScanCard = Boolean(onOpenDevice);

  useEffect(() => {
    if (!open) return;
    setCount(inventory.devices.length);
  }, [open, inventory.devices.length, setCount]);

  useEffect(() => {
    if (!open) inventory.closeDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset detail when panel closes
  }, [open]);

  if (!open) return null;

  const handleClose = () => {
    closePanel();
    onCloseTab?.();
  };

  const showLegacyDetail = !useScanCard && (inventory.selected || inventory.detailLoading);

  return (
    <div className="p-bestand-panel" data-testid="capturer-inventory-panel">
      <div className="p-bestand-panel__chrome">
        {showLegacyDetail ? (
          <CapturerDeviceRecord
            device={inventory.selected}
            loading={inventory.detailLoading && !inventory.selected}
            requestingService={inventory.requestingService}
            onClose={inventory.closeDetail}
            onRequestService={(device) => void inventory.requestService(device)}
          />
        ) : (
          <CapturerInventoryList
            inventory={inventory}
            onClose={embedded ? onCloseTab : handleClose}
            onOpenDevice={onOpenDevice}
          />
        )}
      </div>
    </div>
  );
}
