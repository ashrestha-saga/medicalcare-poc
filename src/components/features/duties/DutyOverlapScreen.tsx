"use client";

import { useDutyOverlap } from "@/components/hooks/duties/useDutyOverlap";
import { ListPageShell } from "@/components/features/shared/ListPageShell";

export function DutyOverlapScreen() {
  const list = useDutyOverlap();

  if (!list.canView) {
    return (
      <div className="p-work" data-testid="duty-overlap-denied">
        <main className="p-main">
          <ListPageShell title="Duty overlap" description="Requires duties:view.">
            <p className="text-sm text-muted-foreground">Access denied.</p>
          </ListPageShell>
        </main>
      </div>
    );
  }

  return (
    <div className="p-work" data-testid="duty-overlap-page">
      <main className="p-main">
        <ListPageShell
          title="Duty overlap decisions"
          description="STK does not auto-satisfy DGUV. Record an explicit overlap decision; both duties remain due until closed."
        >
          {list.loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : list.decisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open overlap decisions.</p>
          ) : (
            <ul className="space-y-2">
              {list.decisions.map((d) => (
                <li key={d.id} className="rounded-md border p-3" data-testid={`overlap-${d.id}`}>
                  <p className="text-sm font-medium">
                    {d.inventoryNumber} · {d.coveredDutyKey} ← {d.satisfiedByDutyKey}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{d.reasonText}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Decided {d.decidedAt}</p>
                </li>
              ))}
            </ul>
          )}
        </ListPageShell>
      </main>
    </div>
  );
}
