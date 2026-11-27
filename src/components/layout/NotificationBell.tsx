"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useNotificationBell } from "@/components/hooks/notifications/useNotificationBell";
import { BellIcon } from "@/components/layout/navIcons";
import { formatDateTime } from "@/lib/format";
import type { AppLocale } from "@/lib/locale";

/** Account-bar / console notification dropdown (E107). */
export function NotificationBell({
  enabled = true,
  seeAllHref = "/notifications",
  variant = "dark",
}: {
  enabled?: boolean;
  /** Full inbox page (clinic `/notifications`, partner `/partner/notifications`). */
  seeAllHref?: string;
  /** Clinic account bar is dark; partner console header is light. */
  variant?: "dark" | "light";
}) {
  const t = useTranslations("notifications");
  const locale = useLocale() as AppLocale;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const { items, unreadCount, loading, disabled, refresh, markRead } = useNotificationBell(enabled);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, refresh]);

  if (!enabled || disabled) return null;

  const badge =
    unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : null;

  return (
    <div
      className="p-notif-bell"
      ref={rootRef}
      data-open={open ? "1" : "0"}
      data-variant={variant}
      data-testid="notification-bell"
    >
      <button
        type="button"
        className="p-notif-bell__toggle"
        aria-label={t("bellAria", { count: unreadCount })}
        aria-expanded={open}
        aria-controls={menuId}
        data-testid="notification-bell-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        <BellIcon />
        {badge ? (
          <span className="p-notif-bell__badge" data-testid="notification-bell-badge">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="p-notif-bell__panel"
          id={menuId}
          role="dialog"
          aria-label={t("bellTitle")}
          data-testid="notification-bell-panel"
        >
          <div className="p-notif-bell__head">
            <p className="p-notif-bell__title">{t("bellTitle")}</p>
            {unreadCount > 0 ? (
              <span className="p-notif-bell__count">{t("bellUnread", { count: unreadCount })}</span>
            ) : null}
          </div>

          {loading && !items.length ? (
            <p className="p-notif-bell__empty">{t("loading")}</p>
          ) : !items.length ? (
            <p className="p-notif-bell__empty" data-testid="notification-bell-empty">
              {t("empty")}
            </p>
          ) : (
            <ul className="p-notif-bell__list">
              {items.map((n) => {
                const kindLabel = t(`kind.${n.kind}` as "kind.assignment");
                const body = (
                  <>
                    <span className="p-notif-bell__item-kind">{kindLabel}</span>
                    <span className="p-notif-bell__item-title">{n.title}</span>
                    {n.body ? <span className="p-notif-bell__item-body">{n.body}</span> : null}
                    <span className="p-notif-bell__item-time">
                      {formatDateTime(n.createdAt, locale)}
                    </span>
                  </>
                );
                const className = [
                  "p-notif-bell__item",
                  n.state === "unread" ? "is-unread" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                if (n.href) {
                  return (
                    <li key={n.id}>
                      <Link
                        href={n.href}
                        className={className}
                        data-testid={`notification-bell-item-${n.id}`}
                        onClick={() => {
                          if (n.state === "unread") void markRead(n.id);
                          setOpen(false);
                        }}
                      >
                        {body}
                      </Link>
                    </li>
                  );
                }

                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={className}
                      data-testid={`notification-bell-item-${n.id}`}
                      onClick={() => {
                        if (n.state === "unread") void markRead(n.id);
                      }}
                    >
                      {body}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="p-notif-bell__foot">
            <Link
              href={seeAllHref}
              className="p-notif-bell__see-all"
              data-testid="notification-bell-see-all"
              onClick={() => setOpen(false)}
            >
              {t("bellSeeAll")}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
