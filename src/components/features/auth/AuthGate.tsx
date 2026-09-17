"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/hooks/useSession";
import { useIdleTimer } from "@/hooks/useIdleTimer";
import { useSessionStore } from "@/store/sessionStore";
import type { AuthGateProps } from "@/interfaces";
import { Loading } from "@/components/ui/Loading";
import { AUTH_HOME, isAuthRoute } from "@/constants/authRoutes";
import { LockScreen } from "./LockScreen";
import { PinSetup } from "./PinSetup";

/**
 * Composes signed-out → (PIN setup) → locked → app. `user` and `locked` are
 * independent, so a locked session survives a reload without re-login.
 * Signed-out users are sent to /login (auth route group).
 */
export function AuthGate({ children }: AuthGateProps) {
  const { status, signOut } = useSession();
  const user = useSessionStore((s) => s.user);
  const locked = useSessionStore((s) => s.locked);
  const pinHash = useSessionStore((s) => s.pinHash);
  const [pinPromptDone, setPinPromptDone] = useState(false);

  useIdleTimer();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("auth")) {
      window.history.replaceState(null, "", AUTH_HOME);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "signed-out" || !user) {
      if (typeof window !== "undefined" && !isAuthRoute(window.location.pathname)) {
        window.location.replace("/login");
      }
    }
  }, [status, user]);

  if (status === "loading") return <Loading label="Checking session…" />;

  if (status === "signed-out" || !user) {
    return <Loading label="Redirecting to sign-in…" />;
  }

  // Skip PIN setup / lock screen while developing locally.
  if (process.env.NODE_ENV === "development") {
    return <>{children}</>;
  }

  if (locked && pinHash) {
    return (
      <LockScreen
        onLockedOut={() => {
          void signOut({
            redirectTo:
              "/login?notice=" + encodeURIComponent("Too many wrong PIN attempts. Please sign in again."),
          });
        }}
        onSignOut={() => {
          void signOut();
        }}
      />
    );
  }

  if (!pinHash && !pinPromptDone) {
    return <PinSetup onDone={() => setPinPromptDone(true)} />;
  }

  return <>{children}</>;
}
