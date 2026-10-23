"use client";

import { useToastStore, type ToastTone } from "@/store/toastStore";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<ToastTone, string> = {
  info: "p-toast--info",
  success: "p-toast--success",
  warning: "p-toast--warning",
  error: "p-toast--error",
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => {
        const isError = t.tone === "error";
        return (
          <div
            key={t.id}
            className={cn(
              "p-toast pointer-events-auto",
              TONE_CLASS[t.tone],
              t.sticky && "p-toast--sticky",
            )}
            style={{
              position: "relative",
              left: "auto",
              right: "auto",
              bottom: "auto",
              maxWidth: 400,
              width: "100%",
            }}
            role={isError ? "alert" : "status"}
            aria-live={isError ? "assertive" : "polite"}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ flex: 1 }}>{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="p-toast__dismiss"
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
