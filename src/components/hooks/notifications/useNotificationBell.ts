"use client";

import { useCallback, useEffect, useState } from "react";
import type { NotificationListDTO, UserNotificationDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";

const PREVIEW_LIMIT = 8;
const POLL_MS = 60_000;

/** Compact inbox for the account-bar bell (E107). */
export function useNotificationBell(enabled: boolean) {
  const [items, setItems] = useState<UserNotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await api<NotificationListDTO>("/api/me/notifications?state=open");
      setItems(res.notifications.slice(0, PREVIEW_LIMIT));
      setUnreadCount(res.unreadCount);
      setDisabled(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setDisabled(true);
        setItems([]);
        setUnreadCount(0);
      }
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled, refresh]);

  const markRead = useCallback(
    async (id: string) => {
      try {
        await api(`/api/me/notifications/${id}/read`, { method: "POST" });
        await refresh();
      } catch {
        /* bell stays best-effort */
      }
    },
    [refresh],
  );

  return { items, unreadCount, loading, disabled, refresh, markRead };
}
