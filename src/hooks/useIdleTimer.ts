"use client";

import { useEffect } from "react";
import { IDLE_LOCK_MS } from "@/constants/roles";
import { useSessionStore } from "@/store/sessionStore";

/** Locks the screen after inactivity when a PIN is set (Phase 10). */
export function useIdleTimer(timeoutMs = IDLE_LOCK_MS) {
  const lock = useSessionStore((s) => s.lock);
  const touch = useSessionStore((s) => s.touch);
  const pinHash = useSessionStore((s) => s.pinHash);
  const status = useSessionStore((s) => s.status);

  useEffect(() => {
    if (status !== "signed-in" || !pinHash) return;
    let timer = window.setTimeout(lock, timeoutMs);
    const reset = () => {
      touch();
      window.clearTimeout(timer);
      timer = window.setTimeout(lock, timeoutMs);
    };
    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    const onVisibility = () => {
      if (document.visibilityState === "hidden") lock();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [lock, touch, pinHash, status, timeoutMs]);
}
