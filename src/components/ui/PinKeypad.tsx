"use client";

import { useEffect, useState } from "react";
import { PIN_LENGTH } from "@/constants/roles";

interface PinKeypadProps {
  onComplete: (pin: string) => void;
  disabled?: boolean;
  label?: string;
}

/** Parents clear digits by remounting via `key`. UX: IBM Plex Mono, 54px keys, 15px dots. */
export function PinKeypad({ onComplete, disabled = false, label }: PinKeypadProps) {
  const [digits, setDigits] = useState("");

  useEffect(() => {
    if (digits.length === PIN_LENGTH) {
      const pin = digits;
      const t = setTimeout(() => {
        onComplete(pin);
        setDigits("");
      }, 120);
      return () => clearTimeout(t);
    }
  }, [digits, onComplete]);

  const press = (d: string) => {
    if (disabled) return;
    setDigits((cur) => (cur.length < PIN_LENGTH ? cur + d : cur));
  };

  return (
    <div data-testid="pin-keypad">
      {label && <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--on-dark-soft)", marginBottom: 12 }}>{label}</p>}
      <div className="p-pin-dots" aria-label={`${digits.length} of ${PIN_LENGTH} digits entered`}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <i key={i} className={i < digits.length ? "on" : ""} />
        ))}
      </div>
      <div className="p-pin-pad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} disabled={disabled} data-testid={`pin-${d}`}>
            {d}
          </button>
        ))}
        <span />
        <button type="button" onClick={() => press("0")} disabled={disabled} data-testid="pin-0">
          0
        </button>
        <button type="button" onClick={() => setDigits((c) => c.slice(0, -1))} disabled={disabled} aria-label="Delete">
          ⌫
        </button>
      </div>
    </div>
  );
}
