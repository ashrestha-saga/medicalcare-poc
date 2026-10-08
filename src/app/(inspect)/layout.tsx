"use client";

import { useEffect, type ReactNode } from "react";
import { AuthGate } from "@/components/features/auth/AuthGate";
import { InspectShell } from "@/components/features/inspect/InspectShell";
import { Toaster } from "@/components/ui/Toaster";
import { Loading } from "@/components/ui/Loading";
import { PermissionProvider } from "@/lib/providers/PermissionProvider";
import { useSession } from "@/hooks/useSession";
import { useSessionStore } from "@/store/sessionStore";
import { isClinicSession, isPartnerSession } from "@/interfaces/session";

function InspectGate({ children }: { children: ReactNode }) {
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

/** Inspection field portal — partner auth, no console chrome. */
export default function InspectLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate loginPath="/login/partner">
      <InspectGate>
        <PermissionProvider>
          <InspectShell>
            {children}
            <Toaster />
          </InspectShell>
        </PermissionProvider>
      </InspectGate>
    </AuthGate>
  );
}
