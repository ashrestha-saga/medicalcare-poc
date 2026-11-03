"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

/** Finger/stylus signature capture — returns PNG data URL. */
export function SignaturePad({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("pruefpartner");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasStroke, setHasStroke] = useState(Boolean(value));

  const redrawStored = useCallback(() => {
    const c = canvasRef.current;
    if (!c || !value) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = value;
  }, [value]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#131817";
    if (value) redrawStored();
  }, [value, redrawStored]);

  function pos(ev: PointerEvent | React.PointerEvent) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: (ev.clientX - r.left) * (c.width / r.width),
      y: (ev.clientY - r.top) * (c.height / r.height),
    };
  }

  function clear() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx?.clearRect(0, 0, c.width, c.height);
    setHasStroke(false);
    onChange(null);
  }

  return (
    <div className="pp-sigbox">
      <canvas
        ref={canvasRef}
        width={640}
        height={180}
        className="pp-sigbox__canvas"
        aria-label={t("signaturePadAria")}
        onPointerDown={(ev) => {
          if (disabled) return;
          drawing.current = true;
          last.current = pos(ev);
          (ev.target as HTMLCanvasElement).setPointerCapture(ev.pointerId);
          ev.preventDefault();
        }}
        onPointerMove={(ev) => {
          if (!drawing.current || disabled) return;
          const c = canvasRef.current;
          const ctx = c?.getContext("2d");
          if (!c || !ctx || !last.current) return;
          const p = pos(ev);
          ctx.beginPath();
          ctx.moveTo(last.current.x, last.current.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          last.current = p;
        }}
        onPointerUp={() => {
          if (!drawing.current) return;
          drawing.current = false;
          const c = canvasRef.current;
          if (!c) return;
          setHasStroke(true);
          onChange(c.toDataURL("image/png"));
        }}
        onPointerLeave={() => {
          if (!drawing.current) return;
          drawing.current = false;
          const c = canvasRef.current;
          if (!c) return;
          setHasStroke(true);
          onChange(c.toDataURL("image/png"));
        }}
      />
      <div className="pp-sigact">
        <button type="button" className="pp-btn" disabled={disabled || !hasStroke} onClick={clear}>
          {t("signatureClear")}
        </button>
        <span className="pp-hint">
          {hasStroke ? t("signatureCaptured") : t("signatureEmpty")}
        </span>
      </div>
    </div>
  );
}
