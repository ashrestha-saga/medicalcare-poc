"use client";

import { useEffect } from "react";
import { useScanStore } from "@/store/scanStore";
import { PartsScreen } from "@/components/features/cart/PartsScreen";
import { DeviceScreen } from "@/components/features/device/DeviceScreen";
import { ActivityLog } from "@/components/features/log/ActivityLog";
import { ManualCaptureForm } from "@/components/features/scan/ManualCaptureForm";
import { ResolvingState } from "@/components/features/scan/ResolvingState";
import { ScanScreen } from "@/components/features/scan/ScanScreen";
import { CameraPane } from "@/components/features/scan/CameraPane";
import { CapturerInventoryPanel } from "@/components/features/scan/CapturerInventoryPanel";
import { ServiceRequestForm } from "@/components/features/service-request/ServiceRequestForm";
import { SuccessState } from "@/components/features/service-request/SuccessState";
import { useFormFactor } from "@/components/layout/AuthenticatedShell";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { useCapturerInventoryUi } from "@/store/capturerInventoryStore";

/**
 * Inventory / scan workflow body. Auth + AppShell come from (app)/layout.
 * Capturer opens Bestandsverzeichnis from the account-bar button.
 */
export function ScanApp() {
  const form = useFormFactor();
  const phase = useScanStore((s) => s.phase);
  const { checkPermission } = usePermissions();
  const isCapturer = !checkPermission("shell:nav") && checkPermission("inventory:view");
  const inventoryOpen = useCapturerInventoryUi((s) => s.open);
  const closeInventory = useCapturerInventoryUi((s) => s.closePanel);
  const showPersistentCamera = form !== "phone";

  useEffect(() => {
    if (!isCapturer) return;
    if (phase !== "idle" && phase !== "manual-entry") closeInventory();
  }, [phase, isCapturer, closeInventory]);

  return (
    <div className="p-work" data-testid="scan-app" data-capturer={isCapturer ? "1" : undefined}>
      {showPersistentCamera && (
        <aside className="p-campane">
          <CameraPane tabletHint />
        </aside>
      )}
      <main className="p-main">
        {isCapturer && inventoryOpen ? (
          <CapturerInventoryPanel />
        ) : (
          <Workflow
            showInlineCamera={!showPersistentCamera && (phase === "idle" || phase === "manual-entry")}
          />
        )}
      </main>
    </div>
  );
}

function Workflow({ showInlineCamera }: { showInlineCamera: boolean }) {
  const phase = useScanStore((s) => s.phase);

  switch (phase) {
    case "idle":
    case "manual-entry":
      return <ScanScreen showCamera={showInlineCamera} />;
    case "resolving":
      return <ResolvingState />;
    case "manual-capture":
      return <ManualCaptureForm />;
    case "device":
      return <DeviceScreen />;
    case "service-request":
      return <ServiceRequestForm />;
    case "parts":
      return <PartsScreen />;
    case "submitting":
      return (
        <div className="p-wait" data-testid="submitting-state">
          <strong>Sending…</strong>
          <p>Transmitting the request to the configured destinations.</p>
        </div>
      );
    case "queued":
    case "success":
      return <SuccessState />;
    default:
      return (
        <>
          <ScanScreen showCamera={showInlineCamera} />
          <div className="p-sec">
            <ActivityLog />
          </div>
        </>
      );
  }
}
