"use client";

import { useEffect } from "react";
import { useSession } from "@/hooks/useSession";
import { useSessionStore } from "@/store/sessionStore";
import type { AuthGateProps } from "@/interfaces";
import { Loading } from "@/components/ui/Loading";
import { AUTH_HOME, isAuthRoute } from "@/constants/authRoutes";

/**
 * Signed-out users are sent to loginPath (default /login).
 * Signed-in users render the app.
 */
export function AuthGate({ children, loginPath = "/login" }: AuthGateProps) {
  const { status } = useSession();
  const user = useSessionStore((s) => s.user);

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
        window.location.replace(loginPath);
      }
    }
  }, [status, user, loginPath]);

  if (status === "loading") return <Loading label="Checking session…" />;

  if (status === "signed-out" || !user) {
    return <Loading label="Redirecting to sign-in…" />;
  }

  return <>{children}</>;
}
