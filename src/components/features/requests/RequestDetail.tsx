"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type {
  AssignmentProtocolStepDTO,
  RequestDetailProps,
  ServiceRequestDTO,
} from "@/interfaces";
import { Spinner } from "@/components/ui/Loading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatWhen,
  serviceRequestStateBadge,
  useRequestTransition,
} from "@/components/hooks/requests";
import { formatDate, formatDateTime } from "@/lib/format";
import type { AppLocale } from "@/lib/locale";
import { api } from "@/lib/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { QuoteDecidePanel } from "@/components/features/repairs/QuoteDecidePanel";
import { WithdrawAssignmentDialog } from "./WithdrawAssignmentDialog";

function protocolStepValue(
  step: AssignmentProtocolStepDTO,
  t: (key: string) => string,
  dash: string,
): string {
  const parts: string[] = [];
  if (step.measuredValue?.trim()) {
    parts.push(step.unit ? `${step.measuredValue.trim()} ${step.unit}` : step.measuredValue.trim());
  }
  if (step.note?.trim()) parts.push(step.note.trim());
  if (step.confirmed === true && !parts.length) parts.push(t("stepConfirmed"));
  if (step.confirmed === false && !parts.length) parts.push(t("stepNotConfirmed"));
  if (step.withinLimit === true) parts.push(t("stepWithinLimit"));
  if (step.withinLimit === false) parts.push(t("stepOutOfLimit"));
  return parts.length > 0 ? parts.join(" · ") : dash;
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border py-3 sm:grid-cols-[140px_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

/** Replace ISO timestamps in history notes with locale date-times. */
function formatHistoryNote(note: string, locale: AppLocale): string {
  return note.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z?/g, (iso) =>
    formatDateTime(iso.endsWith("Z") ? iso : `${iso}Z`, locale),
  );
}

export function RequestDetail({
  request,
  canWork,
  canAllocate = false,
  executors = [],
  onBack,
  onUpdated,
  onWithdrawn,
}: RequestDetailProps) {
  const t = useTranslations("requestsDetail");
  const tStatus = useTranslations("status");
  const tCommon = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const { checkPermission } = usePermissions();
  const canDecideQuote = checkPermission("requests:approve");

  async function refreshAfterQuoteDecide() {
    try {
      const next = await api<ServiceRequestDTO>(
        `/api/service-requests/${encodeURIComponent(request.reference)}`,
      );
      onUpdated(next);
    } catch {
      /* toast already from panel */
    }
  }
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [protocolOpen, setProtocolOpen] = useState(false);
  const {
    busy,
    executorOrgId,
    onExecutorChange,
    canAllocate: allocationEditable,
    canTransmit,
    canWithdraw,
    transmit,
    withdraw,
  } = useRequestTransition(request, onUpdated);

  const subtitle = [request.serviceType, request.deviceName].filter(Boolean).join(" · ");
  const stateBadge = serviceRequestStateBadge(request.state);
  const selectDisabled = !canWork || !canAllocate || !allocationEditable || busy;
  const overview = request.completionOverview;

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
      "handed_off",
      "acknowledged",
      "scheduled",
      "in_progress",
      "completed",
      "rejected",
    ] as const;
    return (known as readonly string[]).includes(state)
      ? tStatus(state as (typeof known)[number])
      : stateBadge.label;
  };

  const resultLabel = (result: string): string => {
    if (result === "passed") return t("resultPassed");
    if (result === "passed_with_conditions") return t("resultPassedWithConditions");
    if (result === "failed") return t("resultFailed");
    if (result === "repaired") return t("resultRepaired");
    if (result === "provisional") return t("resultProvisional");
    if (result === "not_repairable") return t("resultNotRepairable");
    if (result === "parts_ordered") return t("resultPartsOrdered");
    return result;
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
        <div className="space-y-4">
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
              <MetaRow label={t("assignee")}>
                {request.assigneeName?.trim() || tCommon("dash")}
              </MetaRow>
              <MetaRow label={t("appointment")}>
                {request.scheduledAt ? formatDateTime(request.scheduledAt, locale) : tCommon("dash")}
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
                    ? t("dueSuffix", { date: formatDate(request.duty.dueAt, locale) })
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
              {canWork && canWithdraw ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setWithdrawOpen(true)}
                  data-testid="withdraw-assignment"
                >
                  {t("withdraw")}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={onBack}>
                {t("back")}
              </Button>
            </div>
          </section>

          {canDecideQuote ? (
            <section
              className="rounded-lg border border-border bg-card p-4 sm:p-5"
              data-testid="quote-decide-section"
            >
              <QuoteDecidePanel
                requestId={request.reference}
                quote={request.quote}
                embed
                onDecided={() => void refreshAfterQuoteDecide()}
              />
            </section>
          ) : null}

          {request.fulfilment === "external" ? (
            <section
              className="rounded-lg border border-border bg-card p-4 sm:p-5"
              data-testid="clinic-external-sv"
            >
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {t("externalTitle")}
              </p>
              <p className="mb-4 text-sm text-muted-foreground">{t("externalHint")}</p>
              <dl>
                <MetaRow label={t("externalOffice")}>
                  {request.external?.orgName?.trim() || tCommon("dash")}
                </MetaRow>
                <MetaRow label={t("externalCommissioned")}>
                  {request.external?.commissionedAt
                    ? formatDate(request.external.commissionedAt, locale)
                    : tCommon("dash")}
                </MetaRow>
                <MetaRow label={t("externalCertificate")}>
                  {request.external?.certificateRef?.trim() || t("externalPendingCert")}
                </MetaRow>
                {request.external?.result ? (
                  <MetaRow label={t("externalResult")}>{request.external.result}</MetaRow>
                ) : null}
              </dl>
              {!request.external?.certificateRef && canDecideQuote ? (
                <div className="mt-4">
                  <Button type="button" size="sm" asChild data-testid="request-sv-certificate-cta">
                    <Link
                      href={`/requests/sv-certificate?reference=${encodeURIComponent(request.reference)}`}
                    >
                      {t("externalRecordCertificate")}
                    </Link>
                  </Button>
                </div>
              ) : null}
            </section>
          ) : null}

          {request.fulfilment === "send_in" ? (
            <section
              className="rounded-lg border border-border bg-card p-4 sm:p-5"
              data-testid="clinic-send-in-timeline"
            >
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {t("sendInTitle")}
              </p>
              <p className="mb-4 text-sm text-muted-foreground">{t("sendInHint")}</p>
              <dl>
                {(
                  [
                    ["shippedAt", "sendInShipped"],
                    ["atWorkshopAt", "sendInAtWorkshop"],
                    ["returnedAt", "sendInReturned"],
                    ["arrivedAt", "sendInArrived"],
                  ] as const
                ).map(([key, labelKey]) => {
                  const value = request.sendIn?.[key] ?? null;
                  return (
                    <MetaRow key={key} label={t(labelKey)}>
                      {value ? formatDate(value, locale) : t("sendInPending")}
                    </MetaRow>
                  );
                })}
                <MetaRow label={t("sendInTracking")}>
                  {request.sendIn?.trackingRef?.trim() || tCommon("dash")}
                </MetaRow>
                {request.checkType ? (
                  <MetaRow label={t("checkType")}>{request.checkType}</MetaRow>
                ) : null}
                {request.mandatory ? (
                  <MetaRow label={t("mandatory")}>{t("mandatory")}</MetaRow>
                ) : null}
              </dl>
            </section>
          ) : null}

          {overview ? (
            <section
              className="rounded-lg border border-border bg-card p-4 sm:p-5"
              data-testid="assignment-completion-overview"
            >
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {t("overviewTitle")}
              </p>
              <p className="mb-4 text-sm text-muted-foreground">{t("overviewIntro")}</p>
              <dl>
                <MetaRow label={t("overviewStatus")}>{stateLabel(overview.status)}</MetaRow>
                <MetaRow label={t("overviewResult")}>{resultLabel(overview.result)}</MetaRow>
                <MetaRow label={t("overviewPerformedAt")}>
                  {overview.completedAt
                    ? formatDate(overview.completedAt, locale)
                    : tCommon("dash")}
                </MetaRow>
                <MetaRow label={t("overviewStartedAt")}>
                  {overview.startedAt
                    ? formatDateTime(overview.startedAt, locale)
                    : tCommon("dash")}
                </MetaRow>
                <MetaRow label={t("overviewFinishedAt")}>
                  {overview.finishedAt
                    ? formatDateTime(overview.finishedAt, locale)
                    : overview.completedAt
                      ? formatDateTime(overview.completedAt, locale)
                      : tCommon("dash")}
                </MetaRow>
                <MetaRow label={t("overviewCompletedBy")}>
                  {overview.completedBy?.trim() || tCommon("dash")}
                </MetaRow>
                <MetaRow label={t("overviewProtocol")}>
                  <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>
                      {overview.catalogueLabel || overview.catalogueCode || tCommon("dash")}
                      {overview.catalogueCode && overview.catalogueLabel
                        ? ` (${overview.catalogueCode})`
                        : ""}
                    </span>
                    {(overview.protocolSteps?.length ?? 0) > 0 ? (
                      <button
                        type="button"
                        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                        onClick={() => setProtocolOpen(true)}
                        data-testid="overview-protocol-link"
                      >
                        {t("overviewViewProtocol")}
                      </button>
                    ) : null}
                  </span>
                </MetaRow>
                <MetaRow label={t("overviewNextDue")}>
                  {overview.nextDueAt ? formatDate(overview.nextDueAt, locale) : tCommon("dash")}
                </MetaRow>
                <MetaRow label={t("overviewNotes")}>
                  {overview.note?.trim() || tCommon("dash")}
                </MetaRow>
              </dl>
            </section>
          ) : null}
        </div>

        <aside
          className="rounded-lg border border-border bg-card p-4 sm:p-5"
          data-testid="assignment-history"
        >
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {t("history")}
          </p>
          <ul className="space-y-2">
            {request.statusEvents.map((e, i) => {
              const rawNote = e.note?.trim() || "";
              const isLegacyAdvance = /^Disposition advance →/.test(rawNote);
              const headline = isLegacyAdvance
                ? stateLabel(e.state)
                : rawNote
                  ? formatHistoryNote(rawNote, locale)
                  : stateLabel(e.state);
              return (
                <li
                  key={`${e.changedAt}-${e.state}-${i}`}
                  className="rounded-md border border-border bg-background px-3 py-2.5"
                >
                  <p className="text-xs text-muted-foreground">{formatWhen(e.changedAt, locale)}</p>
                  <p className="text-sm font-medium text-foreground">{headline}</p>
                  {e.actor ? <p className="text-xs text-muted-foreground">{e.actor}</p> : null}
                </li>
              );
            })}
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

      <Dialog open={protocolOpen} onOpenChange={setProtocolOpen}>
        <DialogContent
          className="max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-xl"
          data-testid="overview-protocol-dialog"
        >
          <DialogHeader>
            <DialogTitle>{t("protocolModalTitle")}</DialogTitle>
            <DialogDescription>
              {[overview?.catalogueLabel, overview?.catalogueCode].filter(Boolean).join(" · ") ||
                t("protocolModalFallback")}
            </DialogDescription>
          </DialogHeader>
          {overview ? (
            <dl className="rounded-md border border-border bg-background px-3 py-2 text-sm">
              <div className="grid gap-1 border-b border-border py-2 sm:grid-cols-[120px_1fr] sm:gap-3">
                <dt className="text-muted-foreground">{t("overviewPerformedAt")}</dt>
                <dd className="font-medium">
                  {overview.completedAt
                    ? formatDate(overview.completedAt, locale)
                    : tCommon("dash")}
                </dd>
              </div>
              <div className="grid gap-1 border-b border-border py-2 sm:grid-cols-[120px_1fr] sm:gap-3">
                <dt className="text-muted-foreground">{t("overviewStartedAt")}</dt>
                <dd className="font-medium">
                  {overview.startedAt
                    ? formatDateTime(overview.startedAt, locale)
                    : tCommon("dash")}
                </dd>
              </div>
              <div className="grid gap-1 py-2 sm:grid-cols-[120px_1fr] sm:gap-3">
                <dt className="text-muted-foreground">{t("overviewFinishedAt")}</dt>
                <dd className="font-medium">
                  {overview.finishedAt
                    ? formatDateTime(overview.finishedAt, locale)
                    : tCommon("dash")}
                </dd>
              </div>
            </dl>
          ) : null}
          {(overview?.protocolSteps?.length ?? 0) > 0 ? (
            <ol className="space-y-2" data-testid="overview-protocol-steps">
              {overview!.protocolSteps.map((step) => (
                <li
                  key={`${step.position}-${step.label}`}
                  className="rounded-md border border-border bg-background px-3 py-2.5"
                >
                  <p className="text-xs text-muted-foreground">
                    {t("protocolStepIndex", { n: step.position })}
                    {step.inputKind ? ` · ${step.inputKind}` : ""}
                  </p>
                  <p className="text-sm font-medium text-foreground">{step.label}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {protocolStepValue(step, t, tCommon("dash"))}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">{t("protocolModalEmpty")}</p>
          )}
        </DialogContent>
      </Dialog>

      <WithdrawAssignmentDialog
        open={withdrawOpen}
        reference={request.reference}
        busy={busy}
        onOpenChange={setWithdrawOpen}
        onConfirm={() => {
          void withdraw().then((ok) => {
            if (ok) {
              setWithdrawOpen(false);
              onWithdrawn?.();
            }
          });
        }}
      />
    </div>
  );
}
