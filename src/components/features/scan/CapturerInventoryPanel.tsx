"use client";

import { useEffect } from "react";
import { useCapturerInventory } from "@/components/hooks/scan/useCapturerInventory";
import { CapturerInventoryList } from "@/components/features/scan/CapturerInventoryList";
import { CapturerDeviceRecord } from "@/components/features/scan/CapturerDeviceRecord";
import { useCapturerInventoryUi } from "@/store/capturerInventoryStore";

/** Full-panel Bestandsverzeichnis opened from the account-bar button. */
export function CapturerInventoryPanel() {
  const open = useCapturerInventoryUi((s) => s.open);
  const closePanel = useCapturerInventoryUi((s) => s.closePanel);
  const setCount = useCapturerInventoryUi((s) => s.setCount);
  const inventory = useCapturerInventory(open);

  useEffect(() => {
    if (!open) return;
    setCount(inventory.devices.length);
  }, [open, inventory.devices.length, setCount]);

  useEffect(() => {
    if (!open) inventory.closeDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset detail when panel closes
  }, [open]);

  if (!open) return null;

  return (
    <div className="p-bestand-panel" data-testid="capturer-inventory-panel">
      <div className="p-bestand-panel__chrome">
        {inventory.selected || inventory.detailLoading ? (
          <CapturerDeviceRecord
            device={inventory.selected}
            loading={inventory.detailLoading && !inventory.selected}
            onClose={inventory.closeDetail}
          />
        ) : (
          <CapturerInventoryList inventory={inventory} onClose={closePanel} />
        )}
      </div>
    </div>
  );
}
