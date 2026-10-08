"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSession } from "@/hooks/useSession";
import { useSessionStore } from "@/store/sessionStore";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { LocaleToggle } from "@/components/features/shared/LocaleToggle";
import { useInspectQueueStore } from "@/store/inspectQueueStore";

/** Field portal chrome — no console side nav. */
export function InspectShell({ children }: { children: ReactNode }) {
  const t = useTranslations("pruefpartner");
  const { signOut } = useSession();
  const user = useSessionStore((s) => s.user);
  const online = useOnlineStatus();
  const tenantId = useInspectQueueStore((s) => s.tenantId);
  const tenantName = useInspectQueueStore((s) => s.tenantName);

  return (
    <div className="pp-shell" data-testid="inspect-shell">
      <header className="pp-head">
        <div className="pp-head__brand">
          <span className="pp-mark">DeviceCare</span>
          <span className="pp-head__sep">·</span>
          <span className="pp-head__portal">{t("portalName")}</span>
        </div>
        <div className="pp-head__meta">
          {!online ? <span className="pp-offline">{t("offlineBadge")}</span> : null}
          {tenantName || tenantId ? (
            <span className="pp-ident" title={tenantId ?? undefined}>
              {tenantName ?? tenantId}
            </span>
          ) : null}
          <span className="pp-who">{user?.name ?? "—"}</span>
          <LocaleToggle />
          <button type="button" className="pp-head__logout" onClick={() => void signOut()}>
            {t("logout")}
          </button>
          <Link href={tenantId ? `/partner/my-sites/${encodeURIComponent(tenantId)}` : "/partner/my-sites"} className="pp-head__console">
            {t("backToConsole")}
          </Link>
        </div>
      </header>
      <main className="pp-main">{children}</main>
    </div>
  );
}
