"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AccessDenied } from "@/components/features/shared/AccessDenied";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { cn } from "@/lib/utils";
import { toast } from "@/store/toastStore";

type RefRow = {
  name: string;
  value: number;
  unit: string;
  tolerancePct?: number | null;
  toleranceAbs?: number | null;
};

type DueRow = {
  id: string;
  dueAt: string;
  inventoryNumber: string;
  deviceLabel: string | null;
  constancyObjectCode: string | null;
  constancyObjectLabel: string | null;
  status: "due_today" | "overdue" | "upcoming";
  openClarificationId: string | null;
  lastPerformedAt: string | null;
  lastPerformedBy: string | null;
  lastResult: string | null;
  cadence: {
    captureMode: "device_protocol" | "manual_measurement" | "visual";
    protocolSource: string | null;
    referenceValuesJson: RefRow[] | null;
    visualCheckpoints: string[];
    intervalValue: number;
    intervalUnit: string;
    basisText: string;
  };
};

type MissingTakt = {
  dutyId: string;
  deviceInstanceId: string;
  inventoryNumber: string;
  deviceLabel: string | null;
  constancyObjectCode: string;
  constancyObjectLabel: string | null;
  defaultCadence: string | null;
};

type RecordRow = {
  id: string;
  performedAt: string;
  inventoryNumber: string;
  constancyObjectCode: string | null;
  constancyObjectLabel: string | null;
  captureMode: "device_protocol" | "manual_measurement" | "visual" | null;
  result: string;
  performedBy: string;
  retentionUntil: string | null;
  attachmentBlobId: string | null;
  measurementsJson: unknown;
  clarificationId: string | null;
};

type Board = {
  duties: DueRow[];
  missingTakt: MissingTakt[];
  records: RecordRow[];
  kpi: {
    dueToday: number;
    overdue: number;
    openClarifications: number;
    records: number;
  };
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

function formatDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split("-");
  if (!y || !m || !d) return day;
  return `${d}.${m}.${y}`;
}

function unitLabel(unit: string, t: (k: string) => string): string {
  if (unit === "years") return t("unitYears");
  if (unit === "months") return t("unitMonths");
  if (unit === "working_days") return t("unitWorkingDays");
  return unit;
}

type Lens = "due" | "all";

/** E87 — clinic Konstanz routine capture (modes A / B / C). */
export function ConstancyRoutineScreen({
  embedded = false,
  onNeedCadence,
}: {
  embedded?: boolean;
  onNeedCadence?: () => void;
} = {}) {
  const t = useTranslations("pages.constancyRoutine");
  const { checkPermission, permissionsLoading } = usePermissions();
  const canView = checkPermission("duties:view");
  const canSubmit = checkPermission("inventory:update");
  const canResolve = checkPermission("requests:approve");

  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [lens, setLens] = useState<Lens>("due");
  const [dutyId, setDutyId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [performedAt, setPerformedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [modeAResult, setModeAResult] = useState<"passed" | "failed">("passed");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [measurements, setMeasurements] = useState<Record<string, string>>({});
  const [visualChecks, setVisualChecks] = useState<
    Record<string, { ok: boolean; finding: string }>
  >({});
  const [saving, setSaving] = useState(false);
  const [clarificationId, setClarificationId] = useState<string | null>(null);
  const [continueReason, setContinueReason] = useState("");
  const [resolving, setResolving] = useState(false);

  const duties = board?.duties ?? [];
  const selected = useMemo(
    () => duties.find((d) => d.id === dutyId) ?? null,
    [duties, dutyId],
  );
  const dueNow = useMemo(
    () => duties.filter((d) => d.status === "due_today" || d.status === "overdue"),
    [duties],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<Board>("/api/duties/konstanz/routine");
      setBoard(res);
      setDutyId((prev) => (prev && res.duties.some((d) => d.id === prev) ? prev : ""));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errorLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!canView || permissionsLoading) return;
    void load();
  }, [canView, permissionsLoading, load]);

  useEffect(() => {
    if (!selected) return;
    const refs = selected.cadence.referenceValuesJson ?? [];
    const next: Record<string, string> = {};
    for (const r of refs) next[r.name] = "";
    setMeasurements(next);
    const points = selected.cadence.visualCheckpoints ?? [];
    const checks: Record<string, { ok: boolean; finding: string }> = {};
    for (const p of points) checks[p] = { ok: true, finding: "" };
    setVisualChecks(checks);
  }, [selected]);

  function closeForm() {
    if (saving || resolving) return;
    setFormOpen(false);
    setClarificationId(null);
    setContinueReason("");
    setDutyId("");
  }

  function openRecord(d: DueRow) {
    setDutyId(d.id);
    setPerformedAt(new Date().toISOString().slice(0, 10));
    setNote("");
    setModeAResult("passed");
    setDataUrl(null);
    setFileName("");
    setContinueReason("");
    if (d.openClarificationId) {
      setClarificationId(d.openClarificationId);
    } else {
      setClarificationId(null);
    }
    setFormOpen(true);
  }

  const modeLabel = (m: DueRow["cadence"]["captureMode"] | null) => {
    if (m === "device_protocol") return t("modeA");
    if (m === "manual_measurement") return t("modeB");
    if (m === "visual") return t("modeC");
    return "—";
  };

  const modeLetter = (m: DueRow["cadence"]["captureMode"] | null) => {
    if (m === "manual_measurement") return "B";
    if (m === "visual") return "C";
    if (m === "device_protocol") return "A";
    return "—";
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      toast.error(t("dutyRequired"));
      return;
    }
    if (!canSubmit) {
      toast.error(t("submitDenied"));
      return;
    }

    const mode = selected.cadence.captureMode;
    let body: Record<string, unknown> = {
      dutyId: selected.id,
      captureMode: mode,
      performedAt,
      note: note.trim() || null,
    };

    if (mode === "device_protocol") {
      body.result = modeAResult;
      if (selected.cadence.protocolSource && !dataUrl) {
        toast.error(t("attachmentRequired"));
        return;
      }
      if (dataUrl) body.dataUrl = dataUrl;
    } else if (mode === "manual_measurement") {
      const refs = selected.cadence.referenceValuesJson ?? [];
      const rows: { name: string; value: number; unit: string }[] = [];
      for (const ref of refs) {
        const raw = measurements[ref.name]?.trim() ?? "";
        const value = Number(raw);
        if (!raw || Number.isNaN(value)) {
          toast.error(t("measurementRequired", { name: ref.name }));
          return;
        }
        rows.push({ name: ref.name, value, unit: ref.unit });
      }
      body.result = "passed";
      body.measurements = rows;
    } else {
      const points = selected.cadence.visualCheckpoints ?? [];
      if (!points.length) {
        toast.error(t("visualPointRequired"));
        return;
      }
      const findings = points.map((point) => {
        const row = visualChecks[point] ?? { ok: true, finding: "" };
        return {
          point,
          ok: row.ok,
          finding: row.ok ? null : row.finding.trim() || null,
        };
      });
      for (const f of findings) {
        if (!f.ok && !f.finding) {
          toast.error(t("visualFindingRequired"));
          return;
        }
      }
      const failed = findings.some((f) => !f.ok);
      body.result = failed ? "failed" : "passed";
      body.visualFindings = findings;
    }

    setSaving(true);
    try {
      const res = await api<{
        result: {
          clarificationId: string | null;
          retentionUntil: string;
          result: string;
        };
      }>("/api/duties/konstanz/routine", {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast.success(t("success"));
      if (res.result.clarificationId) {
        setClarificationId(res.result.clarificationId);
        await load();
      } else {
        setClarificationId(null);
        setNote("");
        setFormOpen(false);
        setDutyId("");
        await load();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setSaving(false);
    }
  }

  async function resolveDeviation(action: "lock" | "continue") {
    if (!clarificationId) return;
    if (action === "continue" && !continueReason.trim()) {
      toast.error(t("continueReasonRequired"));
      return;
    }
    if (!canResolve) {
      toast.error(t("resolveDenied"));
      return;
    }
    setResolving(true);
    try {
      await api(`/api/clarifications/${encodeURIComponent(clarificationId)}/resolve-constancy`, {
        method: "POST",
        body: JSON.stringify({
          action,
          reason: action === "continue" ? continueReason.trim() : null,
          note: action === "lock" ? note.trim() || null : null,
        }),
      });
      toast.success(action === "lock" ? t("locked") : t("continued"));
      setClarificationId(null);
      setContinueReason("");
      setNote("");
      setFormOpen(false);
      setDutyId("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errorResolve"));
    } finally {
      setResolving(false);
    }
  }

  function renderMeasurementSummary(json: unknown): ReactNode {
    if (!Array.isArray(json) || json.length === 0) return "—";
    return (
      <ul className="space-y-0.5">
        {json.map((row, i) => {
          const r = row as {
            name?: string;
            value?: number;
            unit?: string;
            withinLimit?: boolean;
            point?: string;
            ok?: boolean;
            finding?: string;
          };
          if (r.point != null) {
            return (
              <li key={i} className="text-xs">
                {r.point}: {r.ok ? t("resultPassed") : (r.finding ?? t("resultFailed"))}
              </li>
            );
          }
          const outside = r.withinLimit === false;
          return (
            <li key={i} className={cn("text-xs", outside && "text-destructive")}>
              {r.name} {r.value} {r.unit}{" "}
              {r.withinLimit == null
                ? ""
                : outside
                  ? t("outside")
                  : t("withinTolerance")}
            </li>
          );
        })}
      </ul>
    );
  }

  if (permissionsLoading) {
    if (embedded) {
      return <p className="text-sm text-muted-foreground">…</p>;
    }
    return (
      <div className="p-work" data-testid="constancy-routine-loading">
        <main className="p-main">
          <ListPageShell variant="compose" title={t("title")}>
            <p className="text-sm text-muted-foreground">…</p>
          </ListPageShell>
        </main>
      </div>
    );
  }

  if (!canView) {
    return <AccessDenied title={t("title")} testId="constancy-routine-denied" />;
  }

  const kpi = board?.kpi ?? { dueToday: 0, overdue: 0, openClarifications: 0, records: 0 };
  const visibleDuties = lens === "due" ? dueNow : duties;
  const allCount = duties.length + (board?.missingTakt.length ?? 0);
  const modalOpen = formOpen && Boolean(selected);

  const body = (
    <div data-testid="constancy-routine-page">
      <p className="mb-4 text-sm text-muted-foreground">{t("description")}</p>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-background p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("kpi.dueToday")}
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{kpi.dueToday}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("kpi.dueTodayHint")}</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("kpi.overdue")}
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{kpi.overdue}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("kpi.overdueHint")}</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("kpi.clarifications")}
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{kpi.openClarifications}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("kpi.clarificationsHint")}</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("kpi.records")}
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{kpi.records}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("kpi.recordsHint")}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-1" role="tablist" aria-label={t("lensAria")}>
            <button
              type="button"
              role="tab"
              aria-selected={lens === "due"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
                lens === "due"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
              data-testid="constancy-routine-lens-due"
              onClick={() => setLens("due")}
            >
              {t("lensDue", { count: dueNow.length })}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={lens === "all"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
                lens === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
              data-testid="constancy-routine-lens-all"
              onClick={() => setLens("all")}
            >
              {t("lensAll", { count: allCount })}
            </button>
          </div>

          <div className="mb-6 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[880px] text-left text-sm" data-testid="constancy-routine-list">
              <thead className="bg-muted/50 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 font-medium">{t("col.object")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("col.path")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("col.interval")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("col.basis")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("col.last")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("col.status")}</th>
                  <th className="px-3 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {visibleDuties.length === 0 && (lens === "due" || !(board?.missingTakt.length)) ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-muted-foreground" data-testid="constancy-routine-empty">
                      {t("empty")}
                    </td>
                  </tr>
                ) : null}
                {visibleDuties.map((d) => {
                  return (
                    <tr
                      key={d.id}
                      className="border-t"
                      data-testid={`constancy-routine-row-${d.id}`}
                    >
                      <td className="px-3 py-3 align-top">
                        <p className="font-medium">
                          {d.constancyObjectLabel ?? d.constancyObjectCode ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {d.inventoryNumber}
                          {d.deviceLabel ? ` · ${d.deviceLabel}` : ""}
                        </p>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                          {modeLetter(d.cadence.captureMode)}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        {d.cadence.intervalValue} {unitLabel(d.cadence.intervalUnit, t)}
                      </td>
                      <td className="max-w-[180px] px-3 py-3 align-top text-muted-foreground">
                        {d.cadence.basisText}
                      </td>
                      <td className="px-3 py-3 align-top text-muted-foreground">
                        {d.lastPerformedAt ? (
                          <>
                            {formatDay(d.lastPerformedAt)}
                            {d.lastPerformedBy ? (
                              <span className="block text-xs">{d.lastPerformedBy}</span>
                            ) : null}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            d.status === "overdue" &&
                              "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200",
                            d.status === "due_today" &&
                              "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
                            d.status === "upcoming" &&
                              "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
                          )}
                        >
                          {d.status === "overdue"
                            ? t("statusOverdue", { date: formatDay(d.dueAt) })
                            : d.status === "due_today"
                              ? t("statusDueToday")
                              : t("statusUpcoming", { date: formatDay(d.dueAt) })}
                        </span>
                        {d.openClarificationId ? (
                          <span className="mt-1 block text-xs text-destructive">
                            {t("statusClarificationOpen")}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 align-top text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openRecord(d)}
                          data-testid={`constancy-routine-record-${d.id}`}
                        >
                          {t("actions.record")}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {lens === "all"
                  ? (board?.missingTakt ?? []).map((m) => (
                      <tr
                        key={`miss-${m.dutyId}`}
                        className="border-t"
                        data-testid={`constancy-routine-missing-${m.dutyId}`}
                      >
                        <td className="px-3 py-3 align-top">
                          <p className="font-medium">
                            {m.constancyObjectLabel ?? m.constancyObjectCode}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {m.inventoryNumber}
                            {m.deviceLabel ? ` · ${m.deviceLabel}` : ""}
                          </p>
                        </td>
                        <td className="px-3 py-3 align-top text-muted-foreground">—</td>
                        <td className="px-3 py-3 align-top">
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                            {t("statusNoTakt")}
                          </span>
                          {m.defaultCadence ? (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {t("qsHint", { cadence: m.defaultCadence })}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 align-top text-muted-foreground">—</td>
                        <td className="px-3 py-3 align-top text-muted-foreground">—</td>
                        <td className="px-3 py-3 align-top">
                          <span className="text-xs text-amber-800 dark:text-amber-200">
                            {t("statusMandatoryNoDate")}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onNeedCadence?.()}
                            data-testid={`constancy-routine-set-takt-${m.dutyId}`}
                          >
                            {t("actions.setTakt")}
                          </Button>
                        </td>
                      </tr>
                    ))
                  : null}
              </tbody>
            </table>
          </div>

          <Dialog
            open={modalOpen}
            onOpenChange={(next) => {
              if (!next) closeForm();
            }}
          >
            <DialogContent
              className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
              data-testid="constancy-routine-modal"
              aria-describedby={undefined}
            >
              {selected ? (
                <>
                  <DialogHeader>
                    <DialogTitle>
                      {clarificationId
                        ? t("deviationTitle")
                        : t("formTitle", {
                            object:
                              selected.constancyObjectLabel ??
                              selected.constancyObjectCode ??
                              "—",
                          })}
                    </DialogTitle>
                    <DialogDescription>
                      {selected.inventoryNumber}
                      {selected.deviceLabel ? ` · ${selected.deviceLabel}` : ""}
                      {" · "}
                      {modeLabel(selected.cadence.captureMode)}
                      {selected.cadence.protocolSource
                        ? ` · ${t("protocolSource", { source: selected.cadence.protocolSource })}`
                        : ""}
                    </DialogDescription>
                  </DialogHeader>

                  {clarificationId ? (
                    <div
                      className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30"
                      data-testid="constancy-routine-clarification"
                    >
                      <p className="text-sm">{t("deviationPrompt")}</p>
                      {canResolve ? (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="continue-reason">{t("continueReason")}</Label>
                            <Textarea
                              id="continue-reason"
                              value={continueReason}
                              onChange={(e) => setContinueReason(e.target.value)}
                              rows={3}
                            />
                          </div>
                          <DialogFooter className="gap-2 sm:justify-start">
                            <Button
                              type="button"
                              variant="destructive"
                              disabled={resolving}
                              onClick={() => void resolveDeviation("lock")}
                            >
                              {t("lockDevice")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={resolving}
                              onClick={() => void resolveDeviation("continue")}
                            >
                              {t("continueOperation")}
                            </Button>
                          </DialogFooter>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">{t("resolveDenied")}</p>
                      )}
                    </div>
                  ) : (
                    <form
                      className="space-y-4"
                      onSubmit={onSubmit}
                      data-testid="constancy-routine-form"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="performed-at">{t("performedAt")}</Label>
                        <Input
                          id="performed-at"
                          type="date"
                          value={performedAt}
                          onChange={(e) => setPerformedAt(e.target.value)}
                        />
                      </div>

                      {selected.cadence.captureMode === "device_protocol" ? (
                        <>
                          <div className="space-y-2">
                            <Label>{t("result")}</Label>
                            <div className="flex gap-4" role="radiogroup">
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="radio"
                                  name="mode-a-result"
                                  checked={modeAResult === "passed"}
                                  onChange={() => setModeAResult("passed")}
                                />
                                {t("resultPassed")}
                              </label>
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="radio"
                                  name="mode-a-result"
                                  checked={modeAResult === "failed"}
                                  onChange={() => setModeAResult("failed")}
                                />
                                {t("resultFailed")}
                              </label>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="protocol-file">{t("attachment")}</Label>
                            <Input
                              id="protocol-file"
                              type="file"
                              accept="image/*,application/pdf"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) {
                                  setDataUrl(null);
                                  setFileName("");
                                  return;
                                }
                                setFileName(file.name);
                                try {
                                  setDataUrl(await fileToDataUrl(file));
                                } catch {
                                  toast.error(t("error"));
                                }
                              }}
                            />
                            {fileName ? (
                              <p className="text-xs text-muted-foreground">{fileName}</p>
                            ) : null}
                          </div>
                        </>
                      ) : null}

                      {selected.cadence.captureMode === "manual_measurement" ? (
                        <div className="space-y-3">
                          <p className="text-sm font-medium">{t("measurements")}</p>
                          {(selected.cadence.referenceValuesJson ?? []).map((ref) => (
                            <div key={ref.name} className="space-y-1">
                              <Label>
                                {ref.name}
                                <span className="ml-1 font-normal text-muted-foreground">
                                  ({ref.value} {ref.unit}
                                  {ref.tolerancePct != null ? ` ±${ref.tolerancePct}%` : ""}
                                  {ref.toleranceAbs != null ? ` ±${ref.toleranceAbs}` : ""})
                                </span>
                              </Label>
                              <div className="grid gap-2 sm:grid-cols-[1fr_4rem]">
                                <Input
                                  type="number"
                                  step="any"
                                  inputMode="decimal"
                                  placeholder={String(ref.value)}
                                  value={measurements[ref.name] ?? ""}
                                  onChange={(e) =>
                                    setMeasurements((prev) => ({
                                      ...prev,
                                      [ref.name]: e.target.value,
                                    }))
                                  }
                                  data-testid={`measurement-${ref.name}`}
                                />
                                <span className="self-center text-sm text-muted-foreground">
                                  {ref.unit}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {selected.cadence.captureMode === "visual" ? (
                        <fieldset className="space-y-3">
                          <p className="text-sm font-medium">{t("visualPoints")}</p>
                          {(selected.cadence.visualCheckpoints ?? []).map((point, idx) => {
                            const row = visualChecks[point] ?? { ok: true, finding: "" };
                            return (
                              <div
                                key={point}
                                className="space-y-2 rounded-md border p-3"
                                data-testid={`visual-point-${idx}`}
                              >
                                <div className="flex items-start gap-2">
                                  <Checkbox
                                    id={`visual-ok-${idx}`}
                                    checked={row.ok}
                                    onCheckedChange={(v) =>
                                      setVisualChecks((prev) => ({
                                        ...prev,
                                        [point]: {
                                          ok: v === true,
                                          finding: prev[point]?.finding ?? "",
                                        },
                                      }))
                                    }
                                  />
                                  <Label htmlFor={`visual-ok-${idx}`} className="leading-snug">
                                    {point}
                                  </Label>
                                </div>
                                {!row.ok ? (
                                  <Textarea
                                    value={row.finding}
                                    onChange={(e) =>
                                      setVisualChecks((prev) => ({
                                        ...prev,
                                        [point]: {
                                          ok: false,
                                          finding: e.target.value,
                                        },
                                      }))
                                    }
                                    rows={2}
                                    placeholder={t("visualFinding")}
                                  />
                                ) : null}
                              </div>
                            );
                          })}
                        </fieldset>
                      ) : null}

                      <div className="space-y-2">
                        <Label htmlFor="note">{t("noteOptional")}</Label>
                        <Textarea
                          id="note"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          rows={2}
                        />
                      </div>

                      {!canSubmit ? (
                        <p className="text-xs text-muted-foreground">{t("submitDenied")}</p>
                      ) : null}

                      <DialogFooter className="gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={saving}
                          onClick={closeForm}
                        >
                          {t("actions.cancel")}
                        </Button>
                        <Button
                          type="submit"
                          disabled={saving || !canSubmit}
                          data-testid="constancy-routine-submit"
                        >
                          {saving ? t("saving") : t("submit")}
                        </Button>
                      </DialogFooter>
                    </form>
                  )}
                </>
              ) : null}
            </DialogContent>
          </Dialog>

          <section data-testid="constancy-routine-records">
            <h3 className="mb-2 text-sm font-semibold">{t("recordsTitle")}</h3>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-muted/50 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">{t("col.date")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("col.object")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("col.path")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("col.result")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("col.values")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("col.by")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(board?.records ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-muted-foreground">
                        {t("recordsEmpty")}
                      </td>
                    </tr>
                  ) : (
                    (board?.records ?? []).map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-3 align-top">{formatDay(r.performedAt)}</td>
                        <td className="px-3 py-3 align-top">
                          <p className="font-medium">
                            {r.constancyObjectLabel ?? r.constancyObjectCode ?? "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">{r.inventoryNumber}</p>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                            {modeLetter(r.captureMode)}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                              r.result === "passed" || r.result === "passed_with_conditions"
                                ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                                : "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200",
                            )}
                          >
                            {r.result === "deviation"
                              ? t("resultDeviation")
                              : r.result === "failed"
                                ? t("resultFailed")
                                : t("resultPassed")}
                          </span>
                          {r.clarificationId ? (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {t("clarificationRef")}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 align-top">
                          {r.attachmentBlobId ? (
                            <span className="text-xs text-muted-foreground">{t("hasAttachment")}</span>
                          ) : (
                            renderMeasurementSummary(r.measurementsJson)
                          )}
                        </td>
                        <td className="px-3 py-3 align-top text-muted-foreground">
                          <p>{r.performedBy}</p>
                          {r.retentionUntil ? (
                            <p className="mt-1 text-[11px]">
                              {t("retentionUntil", { date: formatDay(r.retentionUntil) })}
                            </p>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );

  if (embedded) return body;

  return (
    <div className="p-work">
      <main className="p-main">
        <ListPageShell variant="compose" title={t("title")} description={t("description")}>
          {body}
        </ListPageShell>
      </main>
    </div>
  );
}
