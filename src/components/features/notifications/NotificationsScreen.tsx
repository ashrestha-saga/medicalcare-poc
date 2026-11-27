"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/features/shared/EmptyState";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { PageLoading } from "@/components/features/shared/PageLoading";
import {
  useNotifications,
  type NotificationFilter,
} from "@/components/hooks/notifications/useNotifications";
import { formatDateTime } from "@/lib/format";
import type { AppLocale } from "@/lib/locale";

const FILTERS: NotificationFilter[] = ["open", "unread", "all"];

/** /notifications — "Für mich" person inbox (E107). */
export function NotificationsScreen() {
  const t = useTranslations("notifications");
  const locale = useLocale() as AppLocale;
  const n = useNotifications();

  if (n.disabled) {
    return (
      <ListPageShell title={t("title")} description={t("disabled")} testId="notifications-disabled">
        <EmptyState>{t("disabled")}</EmptyState>
      </ListPageShell>
    );
  }

  return (
    <ListPageShell
      title={t("title")}
      description={t("description")}
      testId="notifications-screen"
      headerExtra={
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            {t("mailLabel")}
            <select
              className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              value={n.mail}
              onChange={(e) => void n.setMailMode(e.target.value as "off" | "daily")}
              data-testid="notifications-mail-pref"
            >
              <option value="off">{t("mailOff")}</option>
              <option value="daily">{t("mailDaily")}</option>
            </select>
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={n.unreadCount === 0}
            onClick={() => void n.markAllRead()}
          >
            {t("markAllRead")}
          </Button>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f}
            type="button"
            size="sm"
            className="h-8"
            variant={n.filter === f ? "default" : "outline"}
            onClick={() => n.setFilter(f)}
          >
            {t(`filter.${f}`)}
            {f === "unread" && n.unreadCount > 0 ? ` (${n.unreadCount})` : ""}
          </Button>
        ))}
      </div>

      {n.loading && n.items.length === 0 ? (
        <PageLoading label={t("loading")} />
      ) : n.items.length === 0 ? (
        <EmptyState testId="notifications-empty">{t("empty")}</EmptyState>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border" data-testid="notifications-list">
          {n.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
              data-testid="notification-row"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {item.state === "unread" ? <Badge>{t("new")}</Badge> : null}
                  <Badge variant="secondary">{t(`kind.${item.kind}`)}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(item.createdAt, locale)}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-foreground">{item.title}</p>
                {item.body ? <p className="text-sm text-muted-foreground">{item.body}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {item.href ? (
                  <Button asChild variant="ghost" size="sm" className="h-8">
                    <Link href={item.href} onClick={() => void n.markRead(item.id)}>
                      {t("open")}
                    </Link>
                  </Button>
                ) : null}
                {item.state === "unread" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    disabled={n.busyId === item.id}
                    onClick={() => void n.markRead(item.id)}
                  >
                    {t("markRead")}
                  </Button>
                ) : null}
                {item.state !== "done" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={n.busyId === item.id}
                    onClick={() => void n.markDone(item.id)}
                  >
                    {t("markDone")}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </ListPageShell>
  );
}
