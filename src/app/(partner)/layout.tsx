"use client";

import { useEffect, type ReactNode } from "react";
import { AuthGate } from "@/components/features/auth/AuthGate";
import { PartnerShell } from "@/components/layout/PartnerShell";
import { Toaster } from "@/components/ui/Toaster";
import { Loading } from "@/components/ui/Loading";
import { useSession } from "@/hooks/useSession";
import { useSessionStore } from "@/store/sessionStore";
import { isClinicSession, isPartnerSession } from "@/interfaces/session";

function PartnerGate({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const user = useSessionStore((s) => s.user);

  useEffect(() => {
    if (status !== "signed-in" || !user) return;
    if (isClinicSession(user)) {
      window.location.replace("/");
    }
  }, [status, user]);

  if (status === "loading") return <Loading label="Checking session…" />;
  if (status === "signed-in" && user && isClinicSession(user)) {
    return <Loading label="Opening clinic app…" />;
  }
  if (status === "signed-in" && user && !isPartnerSession(user)) {
    return <Loading label="Redirecting…" />;
  }

  return <>{children}</>;
}

/** Partner route group — AuthGate + light shell (no clinic nav / RBAC). */
export default function PartnerLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate loginPath="/login/partner">
      <PartnerGate>
        <PartnerShell>
          {children}
          <Toaster />
        </PartnerShell>
      </PartnerGate>
    </AuthGate>
  );
}
