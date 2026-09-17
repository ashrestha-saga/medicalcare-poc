"use client";

import { useEffect } from "react";
import { useOfflineQueueStore } from "@/store/offlineQueueStore";
import { useLogStore } from "@/store/logStore";
import { toast } from "@/store/toastStore";

/**
 * Tracks navigator.onLine, loads the queue once, and triggers a replay on
 * every reconnect (NFA-802). The replay itself is serialized in lib/offlineQueue.
 */
export function useOnlineStatus() {
  const online = useOfflineQueueStore((s) => s.online);
  const setOnline = useOfflineQueueStore((s) => s.setOnline);
  const load = useOfflineQueueStore((s) => s.load);
  const replay = useOfflineQueueStore((s) => s.replay);

  useEffect(() => {
    void load().then(() => {
      if (navigator.onLine) void replay();
    });
    const up = () => {
      setOnline(true);
      useLogStore.getState().log("queue", "Connection restored — replaying queued requests");
      void replay().then((r) => {
        if (r && r.sent.length) toast.success(`${r.sent.length} queued request${r.sent.length > 1 ? "s" : ""} sent.`);
      });
    };
    const down = () => {
      setOnline(false);
      useLogStore.getState().log("queue", "Connection lost — requests will be queued locally");
    };
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, [load, replay, setOnline]);

  return online;
}
