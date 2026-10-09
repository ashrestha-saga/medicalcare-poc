"use client";

import { useCallback, useRef, useState } from "react";
import type { IdentifierKind } from "@/interfaces";
import { parseIdentifier } from "@/lib/gs1";
import type { BarcodeCaptureOrigin, BarcodeCaptureResult } from "@/lib/barcode/types";

const DUPLICATE_WINDOW_MS = 1200;

type Options = {
  allowedKinds?: readonly IdentifierKind[];
  busy?: boolean;
  onCapture: (result: BarcodeCaptureResult) => void | Promise<void>;
  onRejectedKind?: (kind: IdentifierKind) => void;
};

/**
 * Shared capture pipeline: parse → kind gate → debounce → onCapture.
 * Camera, manual, and keyboard-wedge all call `emit`.
 */
export function useBarcodeCapture({
  allowedKinds,
  busy = false,
  onCapture,
  onRejectedKind,
}: Options) {
  const [value, setValue] = useState("");
  const inFlight = useRef(false);
  const lastEmit = useRef<{ raw: string; at: number } | null>(null);
  const onCaptureRef = useRef(onCapture);
  onCaptureRef.current = onCapture;

  const emit = useCallback(
    async (rawInput: string, origin: BarcodeCaptureOrigin) => {
      const raw = rawInput.trim();
      if (!raw || busy || inFlight.current) return;

      const now = Date.now();
      if (
        lastEmit.current &&
        lastEmit.current.raw === raw &&
        now - lastEmit.current.at < DUPLICATE_WINDOW_MS
      ) {
        return;
      }

      const identifier = parseIdentifier(raw);
      if (allowedKinds?.length && !allowedKinds.includes(identifier.kind)) {
        // Unknown free-text often still carries a plain GTIN digit string — allow if gtin present
        // and gtin/udi-di are allowed.
        const gtinOk =
          Boolean(identifier.gtin || identifier.udiDi) &&
          (allowedKinds.includes("gtin") || allowedKinds.includes("udi-di"));
        if (!gtinOk) {
          onRejectedKind?.(identifier.kind);
          return;
        }
      }

      inFlight.current = true;
      lastEmit.current = { raw, at: now };
      try {
        await onCaptureRef.current({ raw, origin, identifier });
        setValue("");
      } finally {
        inFlight.current = false;
      }
    },
    [allowedKinds, busy, onRejectedKind],
  );

  const submitManual = useCallback(() => {
    void emit(value, "manual");
  }, [emit, value]);

  const parsed = value.trim() ? parseIdentifier(value) : null;

  return {
    value,
    setValue,
    parsed,
    emit,
    submitManual,
  };
}
