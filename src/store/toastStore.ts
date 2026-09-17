"use client";

import { create } from "zustand";

export type ToastTone = "info" | "success" | "warning" | "error";

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  /** Sticky toasts stay until dismissed (used for actionable errors). */
  sticky?: boolean;
}

interface ToastState {
  toasts: Toast[];
  push(tone: ToastTone, message: string, opts?: { sticky?: boolean; durationMs?: number }): void;
  dismiss(id: number): void;
}

let seq = 0;

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (tone, message, opts) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, tone, message, sticky: opts?.sticky }] }));
    if (!opts?.sticky) setTimeout(() => get().dismiss(id), opts?.durationMs ?? (tone === "error" ? 6000 : 3500));
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  info: (m: string) => useToastStore.getState().push("info", m),
  success: (m: string) => useToastStore.getState().push("success", m),
  warning: (m: string) => useToastStore.getState().push("warning", m),
  error: (m: string, sticky = false) => useToastStore.getState().push("error", m, { sticky }),
};
