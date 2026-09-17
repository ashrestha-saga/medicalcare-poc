"use client";

import { useResolve } from "@/components/hooks/scan/useResolve";
import { useScanStore } from "@/store/scanStore";
import { CameraScanner } from "./CameraScanner";
import { KeypadIcon } from "./KeypadIcon";

/** Persistent tablet camera chrome — open-corner ROI, sweep, manual entry (UX §§9–12). */
export function CameraPane({ tabletHint = false }: { tabletHint?: boolean }) {
  const startManualEntry = useScanStore((s) => s.startManualEntry);
  const reset = useScanStore((s) => s.reset);
  const phase = useScanStore((s) => s.phase);
  const { resolve } = useResolve();
  const scanning = phase === "idle";

  return (
    <div className="p-cam" data-testid="camera-pane">
      <CameraScanner
        active={scanning}
        onScan={(raw) => {
          if (useScanStore.getState().phase === "idle") void resolve(raw, "scan");
        }}
      />
      <div className="p-roi" aria-hidden>
        <i />
        <i />
        <i />
        <i />
        {scanning && <div className="p-sweep" />}
      </div>
      <button
        type="button"
        className="p-manualbtn"
        data-testid="manual-entry-open"
        onClick={() => {
          if (phase !== "idle" && phase !== "manual-entry") reset();
          startManualEntry();
        }}
      >
        <KeypadIcon />
        Nummer eingeben
      </button>
      <div className="p-camhint">
        {phase === "manual-entry"
          ? "Scannen pausiert — Nummer rechts eingeben"
          : tabletHint
            ? "Kamera bleibt aktiv — rechts läuft der Vorgang"
            : "Geräteetikett in den Rahmen halten"}
      </div>
    </div>
  );
}
