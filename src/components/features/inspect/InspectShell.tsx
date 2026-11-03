"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSession } from "@/hooks/useSession";
import { useSessionStore } from "@/store/sessionStore";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { LocaleToggle } from "@/components/features/shared/LocaleToggle";
import { useInspectQueueStore } from "@/store/inspectQueueStore";
import { InspectNav } from "@/components/features/inspect/InspectNav";
import {
  INSPECT_NAV_ITEMS,
  INSPECT_NAV_PRESETS,
  inspectNavKeyFromPath,
  isInspectProtocolPath,
} from "@/constants/inspectNav";

const RAIL_KEY = "dc.pp.v10A.rail";
const SELTEN_KEY = "dc.pp.v10A.seltenOpen";

/** Field portal chrome — side rail like Prüfpartner v10-A. */
export function InspectShell({ children }: { children: ReactNode }) {
  const t = useTranslations("pruefpartner");
  const pathname = usePathname() ?? "/inspect/heute";
  const { signOut } = useSession();
  const user = useSessionStore((s) => s.user);
  const online = useOnlineStatus();
  const tenantId = useInspectQueueStore((s) => s.tenantId);
  const tenantName = useInspectQueueStore((s) => s.tenantName);

  const protocol = isInspectProtocolPath(pathname);
  const current = inspectNavKeyFromPath(pathname);

  const [collapsed, setCollapsed] = useState(false);
  const [seltenOpen, setSeltenOpen] = useState(false);
  const [mehrOpen, setMehrOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(RAIL_KEY) === "1");
      setSeltenOpen(localStorage.getItem(SELTEN_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    // Auto-open Selten when current view is in that band.
    const preset = INSPECT_NAV_PRESETS.techniker;
    if (current && preset.selten.includes(current)) setSeltenOpen(true);
  }, [current]);

  const toggleCollapse = () => {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(RAIL_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const toggleSelten = () => {
    setSeltenOpen((v) => {
      const next = !v;
      try {
        localStorage.setItem(SELTEN_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const tabItems = INSPECT_NAV_PRESETS.techniker.taeglich.slice(0, 4);

  return (
    <div
      className="pp-shell"
      data-testid="inspect-shell"
      data-page="inspect"
      data-full={protocol ? "1" : "0"}
      data-rail={collapsed ? "1" : "0"}
    >
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
          <Link
            href={
              tenantId
                ? `/partner/my-sites/${encodeURIComponent(tenantId)}`
                : "/partner/my-sites"
            }
            className="pp-head__console"
          >
            {t("backToConsole")}
          </Link>
        </div>
      </header>

      <div className="pp-body">
        {!protocol ? (
          <InspectNav
            collapsed={collapsed}
            onToggleCollapse={toggleCollapse}
            seltenOpen={seltenOpen}
            onToggleSelten={toggleSelten}
          />
        ) : null}
        <main className="pp-main">{children}</main>
      </div>

      {!protocol ? (
        <nav className="pp-tab" data-testid="inspect-tabbar" aria-label={t("portalName")}>
          {tabItems.map((key) => {
            const meta = INSPECT_NAV_ITEMS.find((i) => i.key === key)!;
            return (
              <Link
                key={key}
                href={meta.href}
                aria-current={current === key ? "page" : undefined}
              >
                <span className="lbl">{t(meta.labelKey)}</span>
              </Link>
            );
          })}
          <button
            type="button"
            aria-expanded={mehrOpen}
            onClick={() => setMehrOpen((v) => !v)}
          >
            <span className="lbl">{t("navMehr")}</span>
          </button>
        </nav>
      ) : null}

      {mehrOpen && !protocol ? (
        <div className="pp-mehr" role="dialog" onClick={() => setMehrOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            {INSPECT_NAV_ITEMS.map((it) => (
              <Link
                key={it.key}
                href={it.href}
                className="nv-item"
                aria-current={current === it.key ? "page" : undefined}
                onClick={() => setMehrOpen(false)}
              >
                <span className="lbl">{t(it.labelKey)}</span>
              </Link>
            ))}
            <button type="button" className="pp-btn close" onClick={() => setMehrOpen(false)}>
              {t("navMehrClose")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
