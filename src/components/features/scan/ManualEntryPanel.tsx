"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ManualEntryPanelProps } from "@/interfaces";
import { IDENTIFIER_KIND_LABELS } from "@/constants/scan";
import { parseIdentifier } from "@/lib/gs1";

/**
 * Inline “Inventarnummer eingeben” panel (mobile full pane / tablet right pane).
 * Live GS1/GTIN parse feedback while typing (same parser as resolve).
 */
export function ManualEntryPanel({ onClose, onSubmit }: ManualEntryPanelProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => (value.trim() ? parseIdentifier(value) : null), [value]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    const raw = value.trim();
    if (!raw) return;
    onSubmit(raw);
    setValue("");
  };

  return (
    <div className="p-manualentry" data-testid="manual-entry-panel">
      <div className="p-manualentry-body">
        <h1 className="p-manualentry-title">Inventarnummer eingeben</h1>
        <p className="p-manualentry-lead">
          Für beschädigte Etiketten, Geräte ohne Barcode oder wenn die Kamera nicht freigegeben ist.
        </p>

        <label className="p-manualentry-label" htmlFor="manual-id">
          Inventar- oder Seriennummer <span className="p-req" aria-hidden="true">*</span>
        </label>
        <input
          ref={inputRef}
          id="manual-id"
          className="p-manualentry-input"
          placeholder="INV-2024-0417"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          data-testid="manual-entry-input"
        />

        {parsed && (
          <p className="p-manualentry-detect" data-testid="manual-entry-detected">
            Detected: {IDENTIFIER_KIND_LABELS[parsed.kind] ?? parsed.kind}
          </p>
        )}

        {parsed?.gtin && (
          <dl className="p-manualentry-gs1" data-testid="manual-entry-gs1">
            <div>
              <dt>GTIN</dt>
              <dd className="t-mono">{parsed.gtin}</dd>
            </div>
            {parsed.serial && (
              <div>
                <dt>Serial</dt>
                <dd className="t-mono">{parsed.serial}</dd>
              </div>
            )}
            {parsed.lot && (
              <div>
                <dt>Lot</dt>
                <dd className="t-mono">{parsed.lot}</dd>
              </div>
            )}
            {parsed.expiry && (
              <div>
                <dt>Expiry</dt>
                <dd className="t-mono">{parsed.expiry}</dd>
              </div>
            )}
          </dl>
        )}

        <div className="p-actions p-manualentry-actions">
          <button type="button" className="btn-secondary" onClick={onClose} data-testid="manual-entry-cancel">
            Zurück
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={submit}
            disabled={!value.trim()}
            data-testid="manual-entry-submit"
          >
            Suchen
          </button>
        </div>
      </div>
    </div>
  );
}
