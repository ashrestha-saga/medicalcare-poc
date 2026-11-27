"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  NotificationListDTO,
  NotificationMailMode,
  UserNotificationDTO,
} from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";

export type NotificationFilter = "open" | "unread" | "all";

/** E107 — person inbox ("Für mich"). */
export function useNotifications() {
  const [filter, setFilter] = useState<NotificationFilter>("open");
  const [items, setItems] = useState<UserNotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mail, setMail] = useState<NotificationMailMode>("off");
  const [loading, setLoading] = useState(true);
  /** Feature flag off for this tenant (API answers 403). */
  const [disabled, setDisabled] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<NotificationListDTO>(`/api/me/notifications?state=${filter}`);
      setItems(res.notifications);
      setUnreadCount(res.unreadCount);
      setMail(res.preferences.mail);
      setDisabled(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setDisabled(true);
      else toast.error(err instanceof ApiError ? err.message : "Could not load notifications");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch lifecycle
    void refresh();
  }, [refresh]);

  const act = useCallback(
    async (id: string, action: "read" | "done") => {
      setBusyId(id);
      try {
        await api(`/api/me/notifications/${id}/${action}`, { method: "POST" });
        await refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Action failed");
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const markAllRead = useCallback(async () => {
    try {
      await api("/api/me/notifications", { method: "POST" });
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed");
    }
  }, [refresh]);

  const setMailMode = useCallback(async (mode: NotificationMailMode) => {
    try {
      await api("/api/me/notifications/preferences", {
        method: "PATCH",
        body: JSON.stringify({ mail: mode }),
      });
      setMail(mode);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save preference");
    }
  }, []);

  return {
    filter,
    setFilter,
    items,
    unreadCount,
    mail,
    loading,
    disabled,
    busyId,
    markRead: (id: string) => act(id, "read"),
    markDone: (id: string) => act(id, "done"),
    markAllRead,
    setMailMode,
    refresh,
  };
}
