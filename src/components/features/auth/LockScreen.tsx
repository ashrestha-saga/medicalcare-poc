"use client";

import { useCallback, useState } from "react";
import type { LockScreenProps } from "@/interfaces";
import { PIN_MAX_ATTEMPTS } from "@/constants/roles";
import { hashPin, useSessionStore } from "@/store/sessionStore";
import { useLogStore } from "@/store/logStore";
import { PinKeypad } from "@/components/ui/PinKeypad";

export function LockScreen({ onLockedOut, onSignOut }: LockScreenProps) {
  const user = useSessionStore((s) => s.user);
  const attempts = useSessionStore((s) => s.pinAttempts);
  const tryUnlock = useSessionStore((s) => s.tryUnlock);
  const [resetKey, setResetKey] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const onComplete = useCallback(
    async (pin: string) => {
      if (!user) return;
      const result = tryUnlock(await hashPin(pin, user.id));
      setResetKey((k) => k + 1);
      if (result === "unlocked") {
        useLogStore.getState().log("auth", "Unlocked with PIN");
        return;
      }
      if (result === "locked-out") {
        useLogStore.getState().log("auth", "PIN locked out — full sign-in required");
        onLockedOut();
        return;
      }
      const left = PIN_MAX_ATTEMPTS - (attempts + 1);
      setMessage(`Wrong PIN. ${left} attempt${left === 1 ? "" : "s"} left.`);
    },
    [user, tryUnlock, attempts, onLockedOut],
  );

  return (
    <div className="p-stage">
      <div className="p-auth">
        <div className="p-auth-card" data-testid="lock-screen">
          <p className="p-sec-title">Locked</p>
          <h1 className="t-title" style={{ marginBottom: 6 }}>
            {user?.name}
          </h1>
          <p style={{ fontSize: 12.5, color: "var(--on-dark-soft)", marginBottom: 20 }}>Enter your PIN to continue.</p>
          {message && (
            <p className="p-err" data-testid="pin-error">
              {message}
            </p>
          )}
          <PinKeypad key={resetKey} onComplete={onComplete} />
          <button type="button" className="p-cta ghost" style={{ marginTop: 18 }} onClick={onSignOut}>
            Sign in as someone else
          </button>
        </div>
      </div>
    </div>
  );
}
