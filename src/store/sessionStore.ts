"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { SessionUser } from "@/interfaces/session";
import { PIN_MAX_ATTEMPTS } from "@/constants/roles";

/**
 * Phase 10 — `user` and `locked` are two independent booleans, matching the
 * mockup's distinction between signed-out and locked-but-signed-in.
 *
 * Only the PIN *hash* is persisted (never a token — SEC-900). The user identity
 * itself is re-read from the httpOnly session cookie via /api/auth/session.
 */

export type AuthStatus = "loading" | "signed-out" | "signed-in";

interface SessionState {
  status: AuthStatus;
  user: SessionUser | null;
  tenantName: string | null;
  locked: boolean;
  pinHash: string | null;
  pinAttempts: number;
  oxidConfigured: boolean;
  lastActivityAt: number;

  setSession(user: SessionUser | null, tenantName?: string | null): void;
  setPinHash(hash: string): void;
  clearPin(): void;
  lock(): void;
  /** Returns "unlocked" | "wrong" | "locked-out" (SEC-901: three attempts → full sign-in). */
  tryUnlock(candidateHash: string): "unlocked" | "wrong" | "locked-out";
  touch(): void;
  signOutLocal(): void;
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      status: "loading",
      user: null,
      tenantName: null,
      locked: false,
      pinHash: null,
      pinAttempts: 0,
      oxidConfigured: false,
      lastActivityAt: Date.now(),

      setSession: (user, tenantName = null) =>
        set((s) => ({
          status: user ? "signed-in" : "signed-out",
          user,
          tenantName: tenantName ?? (user ? s.tenantName : null),
          // A different user must never inherit the previous user's PIN.
          pinHash: user && s.user && s.user.id !== user.id ? null : s.pinHash,
          locked: user ? s.locked : false,
        })),
      setPinHash: (hash) => set({ pinHash: hash, pinAttempts: 0, locked: false }),
      clearPin: () => set({ pinHash: null, pinAttempts: 0, locked: false }),
      lock: () => {
        if (get().pinHash) set({ locked: true, pinAttempts: 0 });
      },
      tryUnlock: (candidateHash) => {
        const { pinHash, pinAttempts } = get();
        if (pinHash && candidateHash === pinHash) {
          set({ locked: false, pinAttempts: 0, lastActivityAt: Date.now() });
          return "unlocked";
        }
        const attempts = pinAttempts + 1;
        if (attempts >= PIN_MAX_ATTEMPTS) {
          set({ pinAttempts: 0, pinHash: null, locked: false, user: null, status: "signed-out" });
          return "locked-out";
        }
        set({ pinAttempts: attempts });
        return "wrong";
      },
      touch: () => set({ lastActivityAt: Date.now() }),
      signOutLocal: () => set({ user: null, status: "signed-out", locked: false, pinHash: null, pinAttempts: 0, tenantName: null }),
    }),
    {
      name: "devicecare.session",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ pinHash: s.pinHash, locked: s.locked }),
    },
  ),
);
