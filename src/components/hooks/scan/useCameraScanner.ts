"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { CameraScannerStatus } from "@/interfaces";
import { CAMERA_READY_TIMEOUT_MS, SCAN_INTERVAL_MS } from "@/constants/scan";

function waitForVideoReady(video: HTMLVideoElement, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        cleanup();
        resolve();
      }
    };
    const onError = () => {
      cleanup();
      reject(new Error("Video failed to start."));
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    const cleanup = () => {
      clearInterval(poll);
      clearTimeout(timeout);
      video.removeEventListener("loadeddata", done);
      video.removeEventListener("playing", done);
      video.removeEventListener("error", onError);
      signal.removeEventListener("abort", onAbort);
    };
    video.addEventListener("loadeddata", done);
    video.addEventListener("playing", done);
    video.addEventListener("error", onError);
    signal.addEventListener("abort", onAbort);
    const poll = setInterval(done, 100);
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Camera preview timed out."));
    }, CAMERA_READY_TIMEOUT_MS);
    void video.play().catch(() => undefined);
    done();
  });
}

function muteZxingWarns(): () => void {
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === "string" && first.includes("MultiFormatReader")) return;
    original.apply(console, args as Parameters<typeof console.warn>);
  };
  return () => {
    console.warn = original;
  };
}

/**
 * Camera stream + continuous barcode decode. Starts after video has frames.
 */
export function useCameraScanner(
  active: boolean,
  onScan: (raw: string) => void,
): { videoRef: RefObject<HTMLVideoElement | null>; status: CameraScannerStatus } {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<CameraScannerStatus>("starting");
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!active) return;

    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let restoreWarn: (() => void) | null = null;
    let lastText = "";
    let lastAt = 0;
    const abort = new AbortController();

    const stopTracks = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      video.srcObject = null;
    };

    const schedule = (fn: () => void, ms: number) => {
      if (cancelled) return;
      timer = setTimeout(fn, ms);
    };

    queueMicrotask(() => {
      if (!cancelled) setStatus("starting");
    });

    (async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setStatus("unavailable");
        return;
      }

      restoreWarn = muteZxingWarns();

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        video.muted = true;
        await waitForVideoReady(video, abort.signal);
        if (cancelled) return;

        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const { BarcodeFormat, DecodeHintType } = await import("@zxing/library");

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.DATA_MATRIX,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.CODE_128,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.CODE_39,
        ]);

        const reader = new BrowserMultiFormatReader(hints);
        if (!cancelled) setStatus("running");

        const tick = () => {
          if (cancelled) return;
          if (document.hidden || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) {
            schedule(tick, SCAN_INTERVAL_MS);
            return;
          }
          try {
            const result = reader.decode(video);
            if (result && !cancelled) {
              const text = result.getText();
              const now = Date.now();
              if (!(text === lastText && now - lastAt < 2500)) {
                lastText = text;
                lastAt = now;
                onScanRef.current(text);
              }
            }
          } catch {
            // Empty frame / no code — expected.
          }
          schedule(tick, SCAN_INTERVAL_MS);
        };

        tick();
      } catch (error) {
        if (cancelled || (error as DOMException)?.name === "AbortError") return;
        const name = (error as { name?: string })?.name;
        setStatus(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
        stopTracks();
      }
    })();

    return () => {
      cancelled = true;
      abort.abort();
      restoreWarn?.();
      stopTracks();
    };
  }, [active]);

  return { videoRef, status };
}
