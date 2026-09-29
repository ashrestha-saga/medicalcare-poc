"use client";

import type { AuditEventDTO } from "@/interfaces";
import { actorKindLabel } from "@/lib/audit/resourceHref";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/Loading";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function AuditTimeline({
  events,
  loading,
  empty = "No activity recorded yet.",
  testId = "audit-timeline",
}: {
  events: AuditEventDTO[];
  loading?: boolean;
  empty?: string;
  testId?: string;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-4" data-testid={testId}>
        <Spinner />
      </div>
    );
  }

  if (!events.length) {
    return (
      <p className="text-xs text-muted-foreground" data-testid={testId}>
        {empty}
      </p>
    );
  }

  return (
    <ul className="space-y-2" data-testid={testId}>
      {events.map((e) => (
        <li key={e.id} className="rounded-md border border-border bg-background px-3 py-2.5">
          <p className="text-xs text-muted-foreground">{formatWhen(e.occurredAt)}</p>
          <p className="text-sm font-medium text-foreground">{e.summary}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>{e.actorName}</span>
            {e.actorKind ? <Badge variant="secondary">{actorKindLabel(e.actorKind)}</Badge> : null}
            {e.organisationName ? <span>· {e.organisationName}</span> : null}
            {e.actorRole ? <span>· {e.actorRole}</span> : null}
          </p>
        </li>
      ))}
    </ul>
  );
}
