"use client";

import { useCallback, useState } from "react";
import type { PinSetupProps } from "@/interfaces";
import { PIN_LENGTH } from "@/constants/roles";
import { hashPin, useSessionStore } from "@/store/sessionStore";
import { useLogStore } from "@/store/logStore";
import { PinKeypad } from "@/components/ui/PinKeypad";

export function PinSetup({ onDone }: PinSetupProps) {
  const user = useSessionStore((s) => s.user);
  const setPinHash = useSessionStore((s) => s.setPinHash);
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const onComplete = useCallback(
    async (pin: string) => {
      if (!user) return;
      if (first === null) {
        setFirst(pin);
        setError(null);
        setResetKey((k) => k + 1);
        return;
      }
      if (pin !== first) {
        setError("The PINs didn't match. Start again.");
        setFirst(null);
        setResetKey((k) => k + 1);
        return;
      }
      setPinHash(await hashPin(pin, user.id));
      useLogStore.getState().log("auth", "Device PIN set");
      onDone();
    },
    [first, user, setPinHash, onDone],
  );

  return (
    <div className="p-stage">
      <div className="p-auth">
        <div className="p-auth-card" data-testid="pin-setup">
          <h1 className="t-title" style={{ marginBottom: 6 }}>
            {first === null ? "PIN festlegen" : "PIN wiederholen"}
          </h1>
          <p style={{ fontSize: 12.5, color: "var(--on-dark-soft)", lineHeight: 1.55, marginBottom: 20 }}>
            {first === null
              ? `A ${PIN_LENGTH}-digit PIN lets you unlock quickly after the screen locks.`
              : "Enter the same PIN once more."}
          </p>
          {error && <p className="p-err">{error}</p>}
          <PinKeypad key={resetKey} onComplete={onComplete} />
          <button type="button" className="p-cta ghost" style={{ marginTop: 18 }} onClick={onDone} data-testid="pin-skip">
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
