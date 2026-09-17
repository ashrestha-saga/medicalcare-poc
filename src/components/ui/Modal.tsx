"use client";

import { useEffect } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        background: "rgba(3,7,14,.72)",
        padding: 0,
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          width: "100%",
          maxWidth: 480,
          background: "var(--navy-2)",
          border: "1px solid var(--border)",
          borderRadius: "16px 16px 0 0",
          padding: 20,
          color: "var(--on-dark)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <h2 className="t-title">{title}</h2>
          <button type="button" className="p-close" style={{ position: "static" }} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div>{children}</div>
        {footer && (
          <div className="p-actions" style={{ marginTop: 20 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
