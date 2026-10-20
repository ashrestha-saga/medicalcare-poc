"use client";

import { useTranslations } from "next-intl";
import type { InventoryScanExtraAction } from "@/interfaces";
import { useScanStore } from "@/store/scanStore";
import { PartsScreen } from "@/components/features/cart/PartsScreen";
import { DeviceScreen } from "@/components/features/device/DeviceScreen";
import { ActivityLog } from "@/components/features/log/ActivityLog";
import { ManualCaptureForm } from "@/components/features/scan/ManualCaptureForm";
import { ResolvingState } from "@/components/features/scan/ResolvingState";
import { ScanScreen } from "@/components/features/scan/ScanScreen";
import { ServiceRequestForm } from "@/components/features/service-request/ServiceRequestForm";
import { SuccessState } from "@/components/features/service-request/SuccessState";

/**
 * Existing scan → inventarize → service / parts phase machine.
 * Kept separate from ScanApp shell so Heute / tabs do not bloat this flow.
 */
export function ScanCameraFlow({
  showInlineCamera,
  onInventoryExtraAction,
}: {
  showInlineCamera: boolean;
  onInventoryExtraAction?: (action: InventoryScanExtraAction) => void;
}) {
  const t = useTranslations("scan");
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
      return <DeviceScreen onInventoryExtraAction={onInventoryExtraAction} />;
    case "service-request":
      return <ServiceRequestForm />;
    case "parts":
      return <PartsScreen />;
    case "submitting":
      return (
        <div className="p-wait" data-testid="submitting-state">
          <strong>{t("sending")}</strong>
          <p>{t("sendingHint")}</p>
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
