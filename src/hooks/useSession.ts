"use client";

import { useCallback, useEffect } from "react";
import type { SessionUser } from "@/interfaces/session";
import { api } from "@/lib/http/apiClient";
import { useActingTenantStore } from "@/store/actingTenantStore";
import { useLogStore } from "@/store/logStore";
import { useSessionStore } from "@/store/sessionStore";

interface SessionResponse {
  user: SessionUser | null;
  tenantName?: string | null;
  homePath?: string;
}

export type SignOutOptions = {
  /** Defaults to `/login`. Pass `null` to skip navigation (tests / callers that redirect themselves). */
  redirectTo?: string | null;
};

/** Hydrates the session store from the httpOnly cookie on mount. */
export function useSession() {
  const status = useSessionStore((s) => s.status);
  const user = useSessionStore((s) => s.user);
  const setSession = useSessionStore((s) => s.setSession);

  const refresh = useCallback(async () => {
    try {
      const session = await api<SessionResponse>("/api/auth/session");
      let next: SessionUser | null = null;
      if (session.user) {
        if (session.user.accountKind === "partner") {
          next = session.user;
        } else {
          next = { ...session.user, accountKind: session.user.accountKind ?? "clinic", tenantId: "" };
        }
      }
      setSession(next, session.tenantName ?? session.user?.companyName ?? null);
    } catch {
      setSession(null);
    }
  }, [setSession]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async (opts?: SignOutOptions) => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    useSessionStore.getState().signOutLocal();
    useActingTenantStore.getState().clearActingTenant();
    useLogStore.getState().log("auth", "Signed out");
    if (opts?.redirectTo === null) return;
    const dest = opts?.redirectTo ?? "/login";
    if (typeof window !== "undefined") window.location.replace(dest);
  }, []);

  return { status, user, refresh, signOut };
}
