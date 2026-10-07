"use client";

import { useTranslations } from "next-intl";
import type { TrainingEventDTO } from "@/interfaces";
import { Spinner } from "@/components/ui/Loading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import {
  eventTitle,
  useTrainingOverview,
} from "@/components/hooks/training/useTrainingOverview";
import { cn } from "@/lib/utils";
import { RecordTrainingForm } from "./RecordTrainingForm";
import { TrainingEventsTable } from "./training-table";

function SummaryTile({
  label,
  value,
  hint,
  tone,
  testId,
}: {
  label: string;
  value: number;
  hint: string;
  tone?: "warning";
  testId: string;
}) {
  return (
    <Card className="shadow-none" data-testid={testId}>
      <CardContent className="px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "mt-1 text-3xl font-semibold tabular-nums",
            tone === "warning" ? "text-amber-700 dark:text-amber-400" : "text-foreground",
          )}
        >
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function EventDetail({
  event,
  onBack,
}: {
  event: TrainingEventDTO;
  onBack: () => void;
}) {
  const t = useTranslations("trainingDetail");
  const tCommon = useTranslations("common");
  const modeLabel = event.mode === "group" ? t("modeGroup") : t("modeIndividual");
  return (
    <div className="px-4 pb-6 pt-4 sm:px-[18px]" data-testid="training-event-detail">
      <button
        type="button"
        className="mb-3 text-sm font-semibold text-primary hover:underline"
        onClick={onBack}
        data-testid="training-back-overview"
      >
        {t("backToOverview")}
      </button>
      <div className="mb-4">
        <h2 className="text-2xl font-semibold tracking-tight">{eventTitle(event)}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {event.trainingTypeLabel} · {event.legalBasis} · {event.heldOn}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Card className="border-border/80 bg-card/60" data-testid="training-records-card">
          <CardHeader>
            <CardTitle className="text-base uppercase tracking-[0.08em] text-muted-foreground">
              {t("individualRecords")}
            </CardTitle>
            <CardDescription>
              {t("recordsFromSession", { count: event.recordCount, mode: modeLabel })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {event.records.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noIndividualRecords")}</p>
            ) : (
              <ul className="p-train__people">
                {event.records.map((r) => (
                  <li key={r.id} className="p-train__person">
                    <div className="p-train__person-main">
                      <b>{r.personName}</b>
                      {r.personJobTitle ? <span>{r.personJobTitle}</span> : null}
                    </div>
                    <span className="p-train__tag is-instructed">{t("confirmed")}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60" data-testid="training-context-card">
          <CardHeader>
            <CardTitle className="text-base uppercase tracking-[0.08em] text-muted-foreground">
              {t("context")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-train__context !p-0">
              <dl className="p-train__meta-grid">
                <div>
                  <dt>{t("instructor")}</dt>
                  <dd>{event.instructorName}</dd>
                </div>
                <div>
                  <dt>{t("qualification")}</dt>
                  <dd>{event.instructorQualification}</dd>
                </div>
                <div>
                  <dt>{t("basis")}</dt>
                  <dd>{event.basisDocument}</dd>
                </div>
                <div>
                  <dt>{t("location")}</dt>
                  <dd>{event.location || tCommon("dash")}</dd>
                </div>
                <div>
                  <dt>{t("status")}</dt>
                  <dd>{event.statusLabel}</dd>
                </div>
              </dl>
              {event.trainingTypeNote ? (
                <p className="p-train__context-note">{event.trainingTypeNote}</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function matrixStatusLabel(
  status: string,
  t: (key: "matrixInstructed" | "matrixEquivalent" | "matrixOpen") => string,
): string {
  if (status === "instructed") return t("matrixInstructed");
  if (status === "equivalent_series") return t("matrixEquivalent");
  if (status === "open") return t("matrixOpen");
  return status;
}

export function TrainingScreen() {
  const t = useTranslations("pages.training");
  const tCards = useTranslations("trainingCards");
  const tDetail = useTranslations("trainingDetail");
  const {
    data,
    error,
    loading,
    view,
    selectedEvent,
    matrixModels,
    matrixPeople,
    cellMap,
    goOverview,
    openEvent,
    openMatrix,
    openRecord,
    onCreated,
  } = useTrainingOverview();

  return (
    <div className="p-work" data-testid="training-page">
      <main className="p-main">
        <div className="p-train" data-testid="training-screen">
          {loading && !data ? (
            <div className="p-wait p-train__loading">
              <Spinner />
            </div>
          ) : null}

          {error ? (
            <div className="p-train__alert">
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          ) : null}

          {!loading && data && view === "record" ? (
            <RecordTrainingForm
              form={data.form}
              onCancel={goOverview}
              onCreated={(id) => void onCreated(id)}
            />
          ) : null}

          {!loading && data && view === "detail" && selectedEvent ? (
            <EventDetail event={selectedEvent} onBack={goOverview} />
          ) : null}

          {!loading && data && view === "detail" && !selectedEvent ? (
            <div className="p-train__alert">
              <Alert>
                <AlertDescription>{tDetail("eventNotFound")}</AlertDescription>
              </Alert>
              <button type="button" className="p-train__back" onClick={goOverview}>
                {tDetail("backToOverview")}
              </button>
            </div>
          ) : null}

          {!loading && data && view === "overview" ? (
            <ListPageShell
              title={t("title")}
              description={t("description")}
              headerExtra={
                <div className="space-y-4">
                  <div className="p-train__kpis !px-0 !pt-0" data-testid="training-summary">
                    <SummaryTile
                      label={tCards("events")}
                      value={data.summary.events}
                      hint={tCards("eventsHint")}
                      testId="training-kpi-events"
                    />
                    <SummaryTile
                      label={tCards("records")}
                      value={data.summary.records}
                      hint={tCards("recordsHint")}
                      testId="training-kpi-records"
                    />
                    <SummaryTile
                      label={tCards("overdue")}
                      value={data.summary.overdue}
                      hint={tCards("overdueHint")}
                      tone={data.summary.overdue > 0 ? "warning" : undefined}
                      testId="training-kpi-overdue"
                    />
                    <SummaryTile
                      label={tCards("withoutRecord")}
                      value={data.summary.withoutRecord}
                      hint={tCards("withoutRecordHint")}
                      tone={data.summary.withoutRecord > 0 ? "warning" : undefined}
                      testId="training-kpi-without-record"
                    />
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openMatrix}
                      data-testid="training-open-matrix"
                    >
                      {t("matrix")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={openRecord}
                      data-testid="training-open-record"
                    >
                      {t("record")}
                    </Button>
                  </div>
                </div>
              }
            >
              <div className="space-y-4">
                <TrainingEventsTable events={data.events} loading={loading} onOpen={openEvent} />

                <aside
                  className="rounded-md border border-border border-l-4 border-l-primary bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
                  data-testid="training-note"
                >
                  <p>
                    <span className="font-medium text-foreground">
                      {tDetail("overviewNoteTitle")}{" "}
                    </span>
                    {tDetail("overviewNoteBody")}
                  </p>
                </aside>
              </div>
            </ListPageShell>
          ) : null}

          {!loading && data && view === "matrix" ? (
            <div>
              <div className="px-4 pt-4 sm:px-[18px]">
                <button
                  type="button"
                  className="text-sm font-semibold text-primary hover:underline"
                  onClick={goOverview}
                  data-testid="training-back-overview"
                >
                  {tDetail("backToOverview")}
                </button>
              </div>
              <ListPageShell
                title={tDetail("matrixTitle")}
                description={tDetail("matrixDescription")}
                className="!pt-2"
              >
              <div className="space-y-4">
                <div
                  className="overflow-hidden rounded-md border border-border bg-card/40"
                  data-testid="training-matrix"
                >
                  {matrixPeople.length === 0 || matrixModels.length === 0 ? (
                    <p className="p-train__empty">
                      {tDetail("matrixEmpty")}
                    </p>
                  ) : (
                    <div className="p-train__table-wrap">
                      <table className="p-train__matrix-table">
                        <thead>
                          <tr>
                            <th>{tDetail("matrixPersonCol")}</th>
                            {matrixModels.map((m) => (
                              <th key={m.id}>{m.name}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {matrixPeople.map((p) => (
                            <tr key={p.id}>
                              <td>
                                <div className="p-train__cell-stack">
                                  <b>{p.name}</b>
                                  {p.jobTitle ? <span>{p.jobTitle}</span> : null}
                                </div>
                              </td>
                              {matrixModels.map((m) => {
                                const status = cellMap.get(`${p.id}:${m.id}`) ?? "open";
                                return (
                                  <td key={m.id}>
                                    <span className={cn("p-train__tag", `is-${status}`)}>
                                      {matrixStatusLabel(status, tDetail)}
                                    </span>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <aside className="rounded-md border border-border border-l-4 border-l-primary bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">
                      {tDetail("matrixNoteTitle")}{" "}
                    </span>
                    {tDetail("matrixNoteBody")}
                  </p>
                </aside>
              </div>
            </ListPageShell>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
