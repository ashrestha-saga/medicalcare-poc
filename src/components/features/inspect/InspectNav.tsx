"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  INSPECT_NAV_ITEMS,
  INSPECT_NAV_PRESETS,
  type InspectNavKey,
  inspectNavKeyFromPath,
} from "@/constants/inspectNav";
import { useAssignmentQueue } from "@/components/hooks/inspect/useAssignmentQueue";
import { filterByBuckets } from "@/lib/inspect/dayBuckets";
import { useOfflineQueueStore } from "@/store/offlineQueueStore";
import { useSessionStore } from "@/store/sessionStore";

const ICONS: Record<InspectNavKey, ReactNode> = {
  heute: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  ),
  woche: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  ),
  queue: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h10" />
      <path d="M18 15l2 2 2-2" />
    </svg>
  ),
  erledigt: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  ),
  nachbesuche: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M4 12a8 8 0 1 0 2.3-5.6" />
      <path d="M4 4v4.5h4.5" />
      <path d="M12 8v4l2.5 1.5" />
    </svg>
  ),
  zugang: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15" r="1.3" />
    </svg>
  ),
  kataloge: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3z" />
      <path d="M5 4v16a3 3 0 0 1 3-3h10" />
      <path d="M9 9h6" />
    </svg>
  ),
};

type Props = {
  collapsed: boolean;
  onToggleCollapse: () => void;
  seltenOpen: boolean;
  onToggleSelten: () => void;
};

export function InspectNav({ collapsed, onToggleCollapse, seltenOpen, onToggleSelten }: Props) {
  const t = useTranslations("pruefpartner");
  const pathname = usePathname() ?? "/inspect/heute";
  const current = inspectNavKeyFromPath(pathname) ?? "heute";
  const user = useSessionStore((s) => s.user);
  const isExternal = Boolean(
    user && "appRole" in user && (user as { isExternal?: boolean }).isExternal,
  );
  // Prefer technician preset; external membership is refined via access API later.
  const preset = INSPECT_NAV_PRESETS[isExternal ? "fremd" : "techniker"];

  const q = useAssignmentQueue();
  const offlineN = useOfflineQueueStore((s) => s.inspectionQueue.length);
  const [accessWarn, setAccessWarn] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/partner/inspect/access", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { warningCount?: number };
        if (!cancelled) setAccessWarn(body.warningCount ?? 0);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const heuteN = filterByBuckets(q.openRows, ["heute", "ohne"]).length;
    return {
      heute: heuteN || null,
      queue: offlineN || null,
      zugang: accessWarn && accessWarn > 0 ? accessWarn : null,
    } as Partial<Record<InspectNavKey, number>>;
  }, [q.openRows, offlineN, accessWarn]);

  const warnKeys = new Set<InspectNavKey>(
    accessWarn && accessWarn > 0 ? ["zugang"] : offlineN > 0 ? ["queue"] : [],
  );

  function item(key: InspectNavKey) {
    const meta = INSPECT_NAV_ITEMS.find((i) => i.key === key)!;
    const cnt = counts[key];
    const warn = warnKeys.has(key);
    return (
      <Link
        key={key}
        href={meta.href}
        className="nv-item"
        data-tip={t(meta.labelKey)}
        aria-current={current === key ? "page" : undefined}
      >
        <span className="ico">{ICONS[key]}</span>
        <span className="lbl">{t(meta.labelKey)}</span>
        {cnt != null ? (
          <span className="cnt" data-w={warn ? "1" : "0"}>
            {cnt}
          </span>
        ) : null}
      </Link>
    );
  }

  const seltenWarnSum = preset.selten.reduce((n, k) => n + (counts[k] && warnKeys.has(k) ? counts[k]! : 0), 0);

  return (
    <nav className="pp-nav" data-testid="inspect-nav" aria-label={t("portalName")}>
      <div className="nv-top">
        <b>{t("portalName")}</b>
        <button
          type="button"
          className="nv-tg"
          onClick={onToggleCollapse}
          title={collapsed ? t("navExpand") : t("navCollapse")}
          aria-label={collapsed ? t("navExpand") : t("navCollapse")}
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      <div className="nv-band">
        <span className="txt">{t("bandTaeglich")}</span>
      </div>
      {preset.taeglich.map(item)}

      {preset.regel.length > 0 ? (
        <>
          <div className="nv-band">
            <span className="txt">{t("bandRegel")}</span>
          </div>
          {preset.regel.map(item)}
        </>
      ) : null}

      {preset.selten.length > 0 ? (
        <>
          <button
            type="button"
            className="nv-band"
            aria-expanded={seltenOpen}
            onClick={onToggleSelten}
          >
            <span className="txt">{t("bandSelten")}</span>
            {seltenWarnSum > 0 && !seltenOpen ? (
              <span className="warn">{seltenWarnSum}</span>
            ) : null}
            <span className="caret">{seltenOpen ? "▾" : "▸"}</span>
          </button>
          {seltenOpen ? preset.selten.map(item) : null}
        </>
      ) : null}

      <div className="nv-foot">
        <span>{t("navPresetFoot")}</span>
      </div>
    </nav>
  );
}
