"use client";

import type { ReactNode } from "react";
import { useSession } from "@/hooks/useSession";
import { useSessionStore } from "@/store/sessionStore";
import { LocaleToggle } from "@/components/features/shared/LocaleToggle";

/** Minimal chrome for partner sessions — org name + sign out, no clinic nav. */
export function PartnerShell({ children }: { children: ReactNode }) {
  const { signOut } = useSession();
  const user = useSessionStore((s) => s.user);
  const tenantName = useSessionStore((s) => s.tenantName);

  return (
    <div className="p-shell" data-testid="partner-shell" data-form="full">
      <header
        className="p-top"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "12px 18px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>DeviceCare · Partner</div>
          <div style={{ fontSize: 12, color: "var(--on-dark-soft)", marginTop: 2 }}>
            {tenantName ?? user?.organisationName ?? user?.name}
            {user?.appRole ? ` · ${user.appRole}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LocaleToggle />
          <button
            type="button"
            className="p-cta ghost"
            data-testid="partner-sign-out"
            onClick={() => void signOut({ redirectTo: "/login/partner" })}
          >
            Sign out
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}
