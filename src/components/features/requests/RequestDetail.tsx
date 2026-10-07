"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { RequestDetailProps } from "@/interfaces";
import { Spinner } from "@/components/ui/Loading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatWhen,
  serviceRequestStateBadge,
  useRequestTransition,
} from "@/components/hooks/requests";
import type { AppLocale } from "@/lib/locale";

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
  const t = useTranslations("requestsDetail");
  const tStatus = useTranslations("status");
  const tCommon = useTranslations("common");
  const locale = useLocale() as AppLocale;
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

  const sourceLabel = (source: string): string =>
    source === "due_date" ? t("sourceDueDate") : t("sourceUserRequest");

  const kindLabel = (kind: string | undefined): string => {
    if (kind === "internal") return t("kindInternal");
    if (kind === "external") return t("kindExternal");
    return kind ?? "";
  };

  const stateLabel = (state: string): string => {
    const known = [
      "captured",
      "queued",
      "transmitted",
      "acknowledged",
      "in_progress",
      "completed",
      "rejected",
    ] as const;
    return (known as readonly string[]).includes(state)
      ? tStatus(state as (typeof known)[number])
      : stateBadge.label;
  };

  return (
    <div className="space-y-4 px-4 pb-8 sm:px-[18px]" data-testid="request-detail">
      <button
        type="button"
        className="text-sm text-muted-foreground hover:text-foreground"
        onClick={onBack}
      >
        {t("backToList")}
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
            {t("assignment")}
          </p>

          <dl>
            <MetaRow label={t("device")}>{request.deviceName ?? tCommon("dash")}</MetaRow>
            <MetaRow label={t("assetNumber")}>
              {request.inventoryNumber ?? request.subjectId}
            </MetaRow>
            <MetaRow label={t("service")}>{request.serviceType}</MetaRow>
            <MetaRow label={t("placeOfUse")}>{request.locationText}</MetaRow>
            <MetaRow label={t("source")}>{sourceLabel(request.source)}</MetaRow>
            <MetaRow label={t("state")}>
              <Badge
                variant={stateBadge.variant}
                className={stateBadge.className}
                data-tone={stateBadge.tone}
              >
                {stateLabel(request.state)}
              </Badge>
            </MetaRow>
            <MetaRow label={t("accessNote")}>{request.accessHint?.trim() || tCommon("dash")}</MetaRow>
          </dl>

          <div className="mt-5 space-y-2" data-testid="allocate-block">
            <label htmlFor="executor-org" className="text-sm text-muted-foreground">
              {t("allocatedTo")}
            </label>
            <select
              id="executor-org"
              className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              value={executorOrgId}
              disabled={selectDisabled}
              onChange={(e) => onExecutorChange(e.target.value)}
              data-testid="executor-select"
            >
              <option value="">{t("pleaseChoose")}</option>
              {executors.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name} · {kindLabel(ex.kind)}
                </option>
              ))}
            </select>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("allocationLockedHint")}
            </p>
          </div>

          {request.source === "due_date" && request.duty ? (
            <div
              className="mt-4 rounded-md border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm leading-relaxed text-foreground"
              data-testid="due-date-context"
            >
              {t("dueDateContext", {
                basisText: request.duty.basisText,
                dueSuffix: request.duty.dueAt
                  ? t("dueSuffix", { date: request.duty.dueAt.slice(0, 10) })
                  : "",
              })}
            </div>
          ) : null}

          {request.note ? (
            <p className="mt-4 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{t("notePrefix")}</span>
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
                {busy ? <Spinner /> : t("transmit")}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={onBack}>
              {t("back")}
            </Button>
          </div>
        </section>

        <aside
          className="rounded-lg border border-border bg-card p-4 sm:p-5"
          data-testid="assignment-history"
        >
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {t("history")}
          </p>
          <ul className="space-y-2">
            {request.statusEvents.map((e, i) => (
              <li
                key={`${e.changedAt}-${e.state}-${i}`}
                className="rounded-md border border-border bg-background px-3 py-2.5"
              >
                <p className="text-xs text-muted-foreground">{formatWhen(e.changedAt, locale)}</p>
                <p className="text-sm font-medium text-foreground">
                  {e.note?.trim() || stateLabel(e.state)}
                </p>
                {e.actor ? <p className="text-xs text-muted-foreground">{e.actor}</p> : null}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            {t("historyCallbackHint")}
          </p>
          {request.source === "due_date" ? (
            <p className="mt-2 text-xs text-muted-foreground">
              <Link href="/due-dates" className="text-primary hover:underline">
                {t("backToDueDates")}
              </Link>
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
