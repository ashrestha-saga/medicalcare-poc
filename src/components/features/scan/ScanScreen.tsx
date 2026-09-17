"use client";

import { useResolve } from "@/components/hooks/scan/useResolve";
import { useScanStore } from "@/store/scanStore";
import { CameraScanner } from "./CameraScanner";
import { KeypadIcon } from "./KeypadIcon";
import { ManualEntryPanel } from "./ManualEntryPanel";

/**
 * Idle / ready / manual-entry workflow pane.
 * Phone: camera fill, or full-screen manual entry (camera stopped).
 * Tablet: ready copy or manual entry on the right; camera stays in the left pane.
 */
export function ScanScreen({ showCamera = true }: { showCamera?: boolean }) {
  const phase = useScanStore((s) => s.phase);
  const startManualEntry = useScanStore((s) => s.startManualEntry);
  const cancelManualEntry = useScanStore((s) => s.cancelManualEntry);
  const lastError = useScanStore((s) => s.lastError);
  const { resolve } = useResolve();
  const manualOpen = phase === "manual-entry";

  if (manualOpen) {
    return (
      <div data-testid="scan-screen" className="p-scanscreen">
        <ManualEntryPanel onClose={cancelManualEntry} onSubmit={(raw) => void resolve(raw, "manual")} />
      </div>
    );
  }

  return (
    <div data-testid="scan-screen" className={showCamera ? "p-scanscreen p-scanscreen--cam" : "p-scanscreen"}>
      {showCamera ? (
        <div className="p-cam">
          <CameraScanner active={phase === "idle"} onScan={(raw) => void resolve(raw, "scan")} />
          <div className="p-roi" aria-hidden>
            <i />
            <i />
            <i />
            <i />
            {phase === "idle" && <div className="p-sweep" />}
          </div>
          <button type="button" className="p-manualbtn" onClick={startManualEntry} data-testid="manual-entry-open">
            <KeypadIcon />
            Nummer eingeben
          </button>
          <div className="p-camhint">Geräteetikett in den Rahmen halten</div>
        </div>
      ) : (
        <div className="p-wait">
          <strong>Bereit zum Scannen</strong>
          <p>Etikett scannen, um Service zu beauftragen oder Ersatzteile zu bestellen.</p>
          {lastError && <p className="p-err">{lastError}</p>}
        </div>
      )}

      {showCamera && lastError && (
        <div className="p-sec">
          <p className="p-err">{lastError}</p>
        </div>
      )}
    </div>
  );
}
