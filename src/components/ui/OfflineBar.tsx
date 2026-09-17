"use client";

import { useOfflineQueueStore } from "@/store/offlineQueueStore";

/** Offline / queue bar — UX §8. Hidden when online and queue empty. */
export function OfflineBar() {
  const online = useOfflineQueueStore((s) => s.online);
  const items = useOfflineQueueStore((s) => s.items);
  const replaying = useOfflineQueueStore((s) => s.replaying);
  const replay = useOfflineQueueStore((s) => s.replay);
  const pending = items.filter((i) => !i.syncedReference).length;

  if (online && pending === 0) return null;

  const label = !online
    ? "Offline — Erfassung läuft weiter"
    : pending === 1
      ? "1 Vorgang wartet auf Verbindung"
      : `${pending} Vorgänge warten auf Verbindung`;

  return (
    <div data-testid="offline-bar" className="p-offbar on">
      <i />
      <span>{label}</span>
      {online && pending > 0 && (
        <button type="button" disabled={replaying} onClick={() => void replay()}>
          {replaying ? "Sending…" : "Send now"}
        </button>
      )}
    </div>
  );
}
