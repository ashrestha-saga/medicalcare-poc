"use client";

import { create } from "zustand";
import type { SessionUser } from "@/interfaces/session";

/**
 * Client session mirror. The real identity is re-read from the httpOnly
 * session cookie via /api/auth/session (SEC-900 — never persist tokens).
 */

export type AuthStatus = "loading" | "signed-out" | "signed-in";

interface SessionState {
  status: AuthStatus;
  user: SessionUser | null;
  tenantName: string | null;
  oxidConfigured: boolean;

  setSession(user: SessionUser | null, tenantName?: string | null): void;
  signOutLocal(): void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  status: "loading",
  user: null,
  tenantName: null,
  oxidConfigured: false,

  setSession: (user, tenantName = null) =>
    set((s) => ({
      status: user ? "signed-in" : "signed-out",
      user,
      tenantName: tenantName ?? (user ? s.tenantName : null),
    })),
  signOutLocal: () =>
    set({ user: null, status: "signed-out", tenantName: null }),
}));
