"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { RequestDetailProps } from "@/interfaces";
import { Spinner } from "@/components/ui/Loading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatWhen,
  serviceRequestStateBadge,
  serviceRequestStateLabel,
  useRequestTransition,
} from "@/components/hooks/requests";

function sourceLabel(source: string): string {
  if (source === "due_date") return "Due date";
  return "User Request";
}

function kindLabel(kind: string | undefined): string {
  if (kind === "internal") return "in-house medical engineering";
  if (kind === "external") return "external";
  return kind ?? "";
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border py-3 sm:grid-cols-[140px_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

export function RequestDetail({
  request,
  canWork,
  canAllocate = false,
  executors = [],
  onBack,
  onUpdated,
}: RequestDetailProps) {
  const {
    busy,
    executorOrgId,
    onExecutorChange,
    canAllocate: allocationEditable,
    canTransmit,
    transmit,
  } = useRequestTransition(request, onUpdated);

  const subtitle = [request.serviceType, request.deviceName].filter(Boolean).join(" · ");
  const stateBadge = serviceRequestStateBadge(request.state);
  const selectDisabled = !canWork || !canAllocate || !allocationEditable || busy;

  return (
    <div className="space-y-4 px-4 pb-8 sm:px-[18px]" data-testid="request-detail">
      <button
        type="button"
        className="text-sm text-muted-foreground hover:text-foreground"
        onClick={onBack}
      >
        ← To the assignment list
      </button>

      <header>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{request.reference}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle || request.serviceType}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.9fr)] lg:items-start">
        <section
          className="rounded-lg border border-border bg-card p-4 sm:p-5"
          data-testid="assignment-card"
        >
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Assignment
          </p>

          <dl>
            <MetaRow label="Device">{request.deviceName ?? "—"}</MetaRow>
            <MetaRow label="Asset number">
              {request.inventoryNumber ?? request.subjectId}
            </MetaRow>
            <MetaRow label="Service">{request.serviceType}</MetaRow>
            <MetaRow label="Einsatzort">{request.locationText}</MetaRow>
            <MetaRow label="Source">{sourceLabel(request.source)}</MetaRow>
            <MetaRow label="State">
              <Badge
                variant={stateBadge.variant}
                className={stateBadge.className}
                data-tone={stateBadge.tone}
              >
                {stateBadge.label}
              </Badge>
            </MetaRow>
            <MetaRow label="Access note">{request.accessHint?.trim() || "—"}</MetaRow>
          </dl>

          <div className="mt-5 space-y-2" data-testid="allocate-block">
            <label htmlFor="executor-org" className="text-sm text-muted-foreground">
              Allocated to
            </label>
            <select
              id="executor-org"
              className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              value={executorOrgId}
              disabled={selectDisabled}
              onChange={(e) => onExecutorChange(e.target.value)}
              data-testid="executor-select"
            >
              <option value="">— please choose —</option>
              {executors.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name} · {kindLabel(ex.kind)}
                </option>
              ))}
            </select>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Not changeable after transmission — the contracted company then has the assignment in
              progress.
            </p>
          </div>

          {request.source === "due_date" && request.duty ? (
            <div
              className="mt-4 rounded-md border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm leading-relaxed text-foreground"
              data-testid="due-date-context"
            >
              Created from a due date. {request.duty.basisText}
              {request.duty.dueAt ? ` · due ${request.duty.dueAt.slice(0, 10)}` : ""}. The result sets
              the reference point for the next period.
            </div>
          ) : null}

          {request.note ? (
            <p className="mt-4 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Note: </span>
              {request.note}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            {canWork && !request.allocationLocked ? (
              <Button
                type="button"
                disabled={busy || !canTransmit}
                onClick={() => void transmit()}
                data-testid="transmit-assignment"
              >
                {busy ? <Spinner /> : "Transmit"}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={onBack}>
              Back
            </Button>
          </div>
        </section>

        <aside
          className="rounded-lg border border-border bg-card p-4 sm:p-5"
          data-testid="assignment-history"
        >
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            History
          </p>
          <ul className="space-y-2">
            {request.statusEvents.map((e, i) => (
              <li
                key={`${e.changedAt}-${e.state}-${i}`}
                className="rounded-md border border-border bg-background px-3 py-2.5"
              >
                <p className="text-xs text-muted-foreground">{formatWhen(e.changedAt)}</p>
                <p className="text-sm font-medium text-foreground">
                  {e.note?.trim() || serviceRequestStateLabel(e.state)}

                </p>
                {e.actor ? <p className="text-xs text-muted-foreground">{e.actor}</p> : null}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Accepted, scheduled and completed come from the contracted company&apos;s status
            callback.
          </p>
          {request.source === "due_date" ? (
            <p className="mt-2 text-xs text-muted-foreground">
              <Link href="/due-dates" className="text-primary hover:underline">
                Back to due dates
              </Link>
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
