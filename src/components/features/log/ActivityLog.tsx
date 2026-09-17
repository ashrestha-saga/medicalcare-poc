"use client";

import { useState } from "react";
import { LOG_CHANNEL_CLASS } from "@/constants/log";
import { useLogStore } from "@/store/logStore";
import { useOfflineQueueStore } from "@/store/offlineQueueStore";

/** Local activity log + offline queue contents — a dev/demo aid (Section 4: components/features/log). */
export function ActivityLog() {
  const entries = useLogStore((s) => s.entries);
  const clear = useLogStore((s) => s.clear);
  const items = useOfflineQueueStore((s) => s.items);
  const dismiss = useOfflineQueueStore((s) => s.dismiss);
  const [open, setOpen] = useState(false);

  return (
    <div className="card overflow-hidden" data-testid="activity-log">
      <button className="flex w-full items-center justify-between px-4 py-3 text-left" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="t-label">Activity log</span>
        <span className="text-xs text-ink-faint">{entries.length} entries · {items.length} queued {open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="border-t border-line">
          {items.length > 0 && (
            <ul className="divide-y divide-line bg-warn-soft/40 text-xs" data-testid="queue-list">
              {items.map((i) => (
                <li key={i.id} className="flex items-start justify-between gap-2 px-4 py-2">
                  <span>
                    <span className="font-medium">{i.summary}</span>
                    <span className="block text-ink-muted">key {i.idempotencyKey.slice(0, 8)}… · retries {i.retryCount}{i.lastError ? ` · ${i.lastError}` : ""}</span>
                  </span>
                  {i.lastError && (i.lastStatus === 400 || i.lastStatus === 422 || i.lastStatus === 404) && (
                    <button className="text-danger underline" onClick={() => void dismiss(i.id)}>discard</button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <ul className="max-h-64 overflow-y-auto divide-y divide-line text-xs">
            {entries.length === 0 && <li className="px-4 py-3 text-ink-faint">Nothing yet.</li>}
            {entries.map((e) => (
              <li key={e.id} className="flex gap-3 px-4 py-1.5">
                <span className="t-mono shrink-0 text-ink-faint">{new Date(e.at).toLocaleTimeString()}</span>
                <span className={`w-14 shrink-0 uppercase ${LOG_CHANNEL_CLASS[e.channel]}`}>{e.channel}</span>
                <span className="min-w-0 break-words">{e.message}</span>
              </li>
            ))}
          </ul>
          {entries.length > 0 && (
            <div className="border-t border-line px-4 py-2 text-right">
              <button className="text-xs text-ink-muted underline" onClick={clear}>Clear</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
