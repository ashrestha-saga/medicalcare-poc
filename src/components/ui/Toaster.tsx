"use client";

import { useToastStore } from "@/store/toastStore";

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="p-toast pointer-events-auto" style={{ position: "relative", left: "auto", right: "auto", bottom: "auto", maxWidth: 400, width: "100%" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ flex: 1 }}>{t.message}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" style={{ border: 0, background: "transparent", cursor: "pointer", fontSize: 16 }}>
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
