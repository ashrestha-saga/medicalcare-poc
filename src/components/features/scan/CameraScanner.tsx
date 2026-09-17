"use client";

import type { CameraScannerProps } from "@/interfaces";
import { useCameraScanner } from "@/components/hooks/scan/useCameraScanner";

/**
 * Camera + continuous barcode decode UI. Logic lives in useCameraScanner.
 */
export function CameraScanner({ active, onScan }: CameraScannerProps) {
  const { videoRef, status } = useCameraScanner(active, onScan);

  if (!active) {
    return <div className="p-camfeed" data-testid="camera-scanner" aria-hidden />;
  }

  return (
    <div className="p-camfeed" data-testid="camera-scanner">
      <video ref={videoRef} muted playsInline autoPlay />
      {status === "starting" && <div className="p-camfeed-status">Starting camera…</div>}
      {(status === "denied" || status === "unavailable") && (
        <div className="p-camfeed-status p-camfeed-status--block">
          {status === "denied" && (
            <>
              <p>Camera access was denied.</p>
              <p className="p-camfeed-hint">Allow camera access, or enter the identifier manually.</p>
            </>
          )}
          {status === "unavailable" && (
            <>
              <p>No camera available.</p>
              <p className="p-camfeed-hint">Use manual entry to identify the device.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
