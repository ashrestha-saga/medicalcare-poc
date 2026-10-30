"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AccessDenied } from "@/components/features/shared/AccessDenied";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import {
  useReprocessingList,
  type ReprocessingTab,
} from "@/components/hooks/reprocessing/useReprocessingList";
import { Button } from "@/components/ui/button";
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
import type {
  RefReprocessingCheckDTO,
  ReprocessingBatchDTO,
  ReprocessingCheckDTO,
} from "@/interfaces";
import { cn } from "@/lib/utils";

type ReleaseChoice = "released" | "released_with_conditions" | "rejected";
type StandKind = "event" | "open" | "never" | "overdue" | "ok";

const CADENCE_DAYS: Record<string, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 91,
  yearly: 365,
};

const TABS: ReprocessingTab[] = ["equipment", "water", "sterile", "batches"];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split("-");
  if (!y || !m || !d) return day;
  return `${d}.${m}.${y}`;
}

function formatTime(iso: string | null | undefined): string | null {
  if (!iso || iso.length < 16) return null;
  return iso.slice(11, 16);
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = formatDate(iso);
  const time = formatTime(iso);
  return time ? `${date} ${time}` : date;
}

function Chip({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "stop";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium",
        tone === "ok" && "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
        tone === "warn" && "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100",
        tone === "stop" && "bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-100",
      )}
    >
      {children}
    </span>
  );
}

function daysSince(isoDate: string): number {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00.000Z`);
  const today = new Date();
  const utc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.max(0, Math.floor((utc - d.getTime()) / 86_400_000));
}

function computeStand(
  ref: RefReprocessingCheckDTO,
  last: ReprocessingCheckDTO | undefined,
  openTodayCodes: Set<string>,
): { kind: StandKind; age?: number; taktDays?: number } {
  if (ref.cadence === "per_batch" || ref.cadence === "per_use") {
    return { kind: "event" };
  }
  if (ref.cadence === "daily") {
    if (openTodayCodes.has(ref.code)) return { kind: "open" };
    return { kind: last ? "ok" : "never" };
  }
  const taktDays = CADENCE_DAYS[ref.cadence];
  if (!last) return { kind: "never" };
  if (taktDays != null) {
    const age = daysSince(last.performedAt);
    if (age > taktDays) return { kind: "overdue", age, taktDays };
  }
  return { kind: "ok" };
}

export function ReprocessingScreen() {
  const t = useTranslations("pages.reprocessing");
  const list = useReprocessingList();
  const [releaseTarget, setReleaseTarget] = useState<ReprocessingBatchDTO | null>(null);
  const [result, setResult] = useState<ReleaseChoice>("released");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [recordTarget, setRecordTarget] = useState<RefReprocessingCheckDTO | null>(null);
  const [recDeviceId, setRecDeviceId] = useState("");
  const [recSiteId, setRecSiteId] = useState("");
  const [recBatchId, setRecBatchId] = useState("");
  const [recDate, setRecDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recPassed, setRecPassed] = useState<"" | "yes" | "no">("");
  const [recValue, setRecValue] = useState("");
  const [recNote, setRecNote] = useState("");

  const openBatches = list.batches.filter((b) => !b.releaseResult);
  const rejected = list.batches.filter((b) => b.releaseResult === "rejected");
  const failedChecks = list.checks.filter((c) => c.passed === false);
  const openTodayCodes = useMemo(
    () => new Set(list.openTodayRefs.map((r) => r.code)),
    [list.openTodayRefs],
  );

  const tabMeta = useMemo(() => {
    const forScopes = (scopes: string[]) => {
      const scoped = list.allRefs.filter((r) => scopes.includes(r.scope));
      let offen = 0;
      let mangel = 0;
      for (const r of scoped) {
        const last = list.latestByCode.get(r.code);
        const st = computeStand(r, last, openTodayCodes);
        if (st.kind === "open" || st.kind === "overdue" || st.kind === "never") offen++;
        if (last?.passed === false) mangel++;
      }
      return {
        n: scoped.length,
        alert: mangel > 0 ? ("stop" as const) : offen > 0 ? ("warn" as const) : ("ok" as const),
      };
    };
    return {
      equipment: forScopes(["equipment"]),
      water: forScopes(["water", "chemistry"]),
      sterile: forScopes(["sterile_storage"]),
      batches: {
        n: list.batches.length,
        alert:
          openBatches.length > 0
            ? ("stop" as const)
            : rejected.length > 0
              ? ("warn" as const)
              : ("ok" as const),
      },
    };
  }, [list.allRefs, list.latestByCode, list.batches, openTodayCodes, openBatches.length, rejected.length]);

  // Open / overdue / never-done checks first; keeps catalogue order otherwise.
  const sortedRefs = useMemo(() => {
    const rank = (r: RefReprocessingCheckDTO) => {
      const kind = computeStand(r, list.latestByCode.get(r.code), openTodayCodes).kind;
      return kind === "open" ? 0 : kind === "overdue" ? 1 : kind === "never" ? 2 : 3;
    };
    return list.refs
      .map((r, i) => ({ r, i, k: rank(r) }))
      .sort((a, b) => a.k - b.k || a.i - b.i)
      .map((x) => x.r);
  }, [list.refs, list.latestByCode, openTodayCodes]);

  if (!list.canView) {
    return (
      <AccessDenied
        title={t("title")}
        description={t("denied")}
        hint={t("denied")}
        testId="reprocessing-denied"
      />
    );
  }

  const submitRelease = async () => {
    if (!releaseTarget) return;
    if (result === "released_with_conditions" && !note.trim()) return;
    setBusy(true);
    try {
      await list.release(releaseTarget.id, result, note.trim() || null);
      setReleaseTarget(null);
      setNote("");
      setResult("released");
    } finally {
      setBusy(false);
    }
  };

  const openRecord = (ref: RefReprocessingCheckDTO) => {
    const last = list.latestByCode.get(ref.code);
    setRecordTarget(ref);
    setRecDeviceId(ref.scope === "equipment" ? (last?.equipmentDeviceId ?? "") : "");
    setRecSiteId(ref.scope !== "equipment" ? (last?.siteId ?? "") : "");
    setRecBatchId("");
    setRecDate(new Date().toISOString().slice(0, 10));
    setRecPassed("");
    setRecValue("");
    setRecNote("");
    void list.loadRecordOptions();
  };

  const recordNeedsSite = (ref: RefReprocessingCheckDTO) =>
    ref.scope === "water" || ref.scope === "chemistry" || ref.scope === "sterile_storage";

  const recordInvalid =
    !recordTarget ||
    !recDate ||
    (recordTarget.scope === "equipment" && !recDeviceId) ||
    (recordNeedsSite(recordTarget) && !recSiteId) ||
    (recordTarget.cadence === "per_batch" && !recBatchId);

  const submitRecord = async () => {
    if (!recordTarget || recordInvalid) return;
    setBusy(true);
    try {
      const ok = await list.recordCheck({
        checkCode: recordTarget.code,
        equipmentDeviceId: recordTarget.scope === "equipment" ? recDeviceId : null,
        siteId: recordNeedsSite(recordTarget) ? recSiteId : null,
        batchId: recordTarget.cadence === "per_batch" ? recBatchId : null,
        performedAt: recDate,
        passed: recPassed === "" ? null : recPassed === "yes",
        measuredValue: recValue.trim() || null,
        note: recNote.trim() || null,
      });
      if (ok) setRecordTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const cadenceLabel = (c: string) => {
    const key = `cadence.${c}` as
      | "cadence.daily"
      | "cadence.per_batch"
      | "cadence.per_use"
      | "cadence.weekly"
      | "cadence.monthly"
      | "cadence.quarterly"
      | "cadence.yearly";
    return t.has(key) ? t(key) : c;
  };

  const standCell = (ref: RefReprocessingCheckDTO, last?: ReprocessingCheckDTO) => {
    const st = computeStand(ref, last, openTodayCodes);
    const chips: ReactNode[] = [];
    if (st.kind === "event") {
      chips.push(
        <Chip key="e" tone="warn">
          {t("stand.event")}
        </Chip>,
      );
      chips.push(
        <span key="e2" className="mt-0.5 block text-[11px] text-muted-foreground">
          {t("stand.eventHint")}
        </span>,
      );
    } else if (st.kind === "open") {
      chips.push(
        <Chip key="o" tone="stop">
          {t("stand.openToday")}
        </Chip>,
      );
    } else if (st.kind === "never") {
      chips.push(
        <Chip key="n" tone="stop">
          {t("stand.never")}
        </Chip>,
      );
    } else if (st.kind === "overdue") {
      chips.push(
        <Chip key="u" tone="stop">
          {t("stand.overdue")}
        </Chip>,
      );
      chips.push(
        <span key="u2" className="mt-0.5 block text-[11px] text-muted-foreground">
          {t("stand.overdueHint", { age: st.age ?? 0, days: st.taktDays ?? 0 })}
        </span>,
      );
    } else {
      chips.push(
        <Chip key="ok" tone="ok">
          {t("stand.ok")}
        </Chip>,
      );
    }
    if (last?.passed === false) {
      chips.push(
        <Chip key="f" tone="stop">
          {t("stand.failed")}
        </Chip>,
      );
    } else if (last?.measuredValue && last.withinLimit == null) {
      chips.push(
        <Chip key="ev" tone="warn">
          {t("stand.unevaluated")}
        </Chip>,
      );
    }
    return <div className="flex flex-col items-start gap-1">{chips}</div>;
  };

  const releaseChip = (b: ReprocessingBatchDTO) => {
    if (!b.releaseResult) {
      return <Chip tone="stop">{t("batch.noDecision")}</Chip>;
    }
    if (b.releaseResult === "released") {
      return <Chip tone="ok">{t("batch.released")}</Chip>;
    }
    if (b.releaseResult === "released_with_conditions") {
      return <Chip tone="warn">{t("batch.conditional")}</Chip>;
    }
    return <Chip tone="warn">{t("batch.blocked")}</Chip>;
  };

  return (
    <div className="p-work" data-testid="reprocessing-page">
      <main className="p-main">
        <ListPageShell title={t("title")} description={t("description")}>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div
              className={cn(
                "rounded-xl border border-border bg-card p-3",
                list.openTodayRefs.length > 0 && "border-amber-400/50",
              )}
            >
              <p
                className={cn(
                  "text-2xl font-semibold tabular-nums",
                  list.openTodayRefs.length > 0 && "text-amber-700 dark:text-amber-300",
                )}
              >
                {list.openTodayRefs.length}
              </p>
              <p className="text-xs text-muted-foreground">{t("kpi.openToday")}</p>
            </div>
            <div
              className={cn(
                "rounded-xl border border-border bg-card p-3",
                openBatches.length > 0 && "border-red-400/40",
              )}
            >
              <p
                className={cn(
                  "text-2xl font-semibold tabular-nums",
                  openBatches.length > 0 && "text-red-700 dark:text-red-300",
                )}
              >
                {openBatches.length}
              </p>
              <p className="text-xs text-muted-foreground">{t("kpi.unreleased")}</p>
            </div>
            <div
              className={cn(
                "rounded-xl border border-border bg-card p-3",
                failedChecks.length > 0 && "border-amber-400/50",
              )}
            >
              <p
                className={cn(
                  "text-2xl font-semibold tabular-nums",
                  failedChecks.length > 0 && "text-amber-700 dark:text-amber-300",
                )}
              >
                {failedChecks.length}
              </p>
              <p className="text-xs text-muted-foreground">{t("kpi.failed")}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-2xl font-semibold tabular-nums">{rejected.length}</p>
              <p className="text-xs text-muted-foreground">{t("kpi.blocked")}</p>
            </div>
          </div>

          {list.unevaluatedCount > 0 ? (
            <div className="mb-4 rounded-lg border border-amber-300/40 border-l-[3px] border-l-amber-500 bg-amber-50/80 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/25 dark:text-amber-50">
              <b>{t("banner.unevaluatedTitle", { count: list.unevaluatedCount })}</b>{" "}
              {t("banner.unevaluatedBody")}
            </div>
          ) : null}

          <div className="mb-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={list.openToday ? "default" : "outline"}
              onClick={() => list.setOpenToday(!list.openToday)}
              data-testid="reprocessing-filter-open-today"
            >
              {t("filter.openToday")}
            </Button>
          </div>

          <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
            {TABS.map((key) => {
              const meta = tabMeta[key];
              const active = list.tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  data-testid={`reprocessing-tab-${key}`}
                  className={cn(
                    "-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "border-primary font-semibold text-foreground"
                      : "border-transparent font-medium text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => list.setTab(key)}
                >
                  {t(`tabs.${key}`)}
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                      meta.alert === "stop" && "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
                      meta.alert === "warn" &&
                        "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
                      meta.alert === "ok" && "bg-muted text-muted-foreground",
                    )}
                  >
                    {meta.n}
                  </span>
                </button>
              );
            })}
          </div>

          {list.loading ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : list.tab === "batches" ? (
            /* Chargen — different columns from routine-check tabs */
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="border-b border-border bg-muted/30 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">{t("col.batch")}</th>
                    <th className="px-3 py-2.5">{t("col.deviceProg")}</th>
                    <th className="px-3 py-2.5">{t("col.run")}</th>
                    <th className="px-3 py-2.5">{t("col.items")}</th>
                    <th className="px-3 py-2.5">{t("col.release")}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.batches.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-muted-foreground">
                        {t("emptyBatches")}
                      </td>
                    </tr>
                  ) : (
                    list.batches.map((b) => {
                      const startT = formatTime(b.startedAt);
                      const endT = formatTime(b.finishedAt);
                      const runLine =
                        startT && endT
                          ? `${startT}–${endT}`
                          : startT
                            ? startT
                            : "—";
                      const itemSummary = b.items
                        .map((i) => {
                          const name = i.label || i.inventoryNumber || "—";
                          return i.quantity > 1 ? `${name} ×${i.quantity}` : name;
                        })
                        .join(" · ");
                      return (
                        <tr key={b.id} className="border-b border-border last:border-0">
                          <td className="px-3 py-3 align-top">
                            <b className="font-semibold">{b.batchNumber}</b>
                            {b.processRecordRef ? (
                              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                {t("protocol")} {b.processRecordRef}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-3 align-top">
                            <span className="font-medium">
                              {b.equipmentLabel || b.inventoryNumber || "—"}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">
                              {b.equipmentLabel && b.inventoryNumber
                                ? `${b.inventoryNumber} · `
                                : ""}
                              {b.programme ?? "—"}
                            </span>
                          </td>
                          <td className="px-3 py-3 align-top font-mono text-xs">
                            {runLine}
                            <span className="mt-0.5 block font-sans text-[11px] text-muted-foreground">
                              {formatDate(b.startedAt)}
                            </span>
                          </td>
                          <td className="px-3 py-3 align-top text-xs">
                            <span className="font-medium">{b.loadPattern || t("itemsCount", { count: b.itemCount })}</span>
                            {itemSummary ? (
                              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                {itemSummary}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-3 align-top">
                            <div className="flex flex-col items-start gap-1">
                              {releaseChip(b)}
                              {b.releasedBy ? (
                                <span className="text-[11px] text-muted-foreground">
                                  {b.releasedBy}, {formatDateTime(b.releasedAt)}
                                </span>
                              ) : null}
                              {list.canRelease && !b.releaseResult ? (
                                <button
                                  type="button"
                                  className="text-[12.5px] font-semibold text-primary hover:underline"
                                  onClick={() => {
                                    setReleaseTarget(b);
                                    setResult("released");
                                    setNote("");
                                  }}
                                >
                                  {t("actions.decide")}
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Equipment / Water+Chemie / Sterilgut — Kontrolle table */
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="border-b border-border bg-muted/30 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">{t("col.check")}</th>
                    <th className="px-3 py-2.5">{t("col.cadence")}</th>
                    <th className="px-3 py-2.5">{t("col.basis")}</th>
                    <th className="px-3 py-2.5">{t("col.last")}</th>
                    <th className="px-3 py-2.5">{t("col.stand")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRefs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-muted-foreground">
                        {list.openToday ? t("emptyOpenToday") : t("emptyChecks")}
                      </td>
                    </tr>
                  ) : (
                    sortedRefs.map((r) => {
                      const last = list.latestByCode.get(r.code);
                      const place =
                        last?.siteName
                          ? t("site", { name: last.siteName })
                          : last?.inventoryNumber
                            ? last.inventoryNumber
                            : r.equipmentTypeCode
                              ? r.equipmentTypeCode
                              : null;
                      const valueLine =
                        last?.measuredValue != null && last.measuredValue !== ""
                          ? `${t("value")} ${last.measuredValue}${r.unit ? ` ${r.unit}` : ""}${
                              r.limitText ? `, ${t("limit")} ${r.limitText}` : `, ${t("noLimit")}`
                            }`
                          : null;
                      return (
                        <tr
                          key={r.code}
                          className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
                          onClick={() => openRecord(r)}
                          data-testid={`reprocessing-check-${r.code}`}
                        >
                          <td className="px-3 py-3 align-top">
                            <b className="text-[13px] font-semibold leading-snug">{r.label}</b>
                            {place ? (
                              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                {place}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-3 align-top font-mono text-xs whitespace-nowrap">
                            {cadenceLabel(r.cadence)}
                          </td>
                          <td className="px-3 py-3 align-top text-xs text-muted-foreground">
                            {r.legalBasis ?? "—"}
                          </td>
                          <td className="px-3 py-3 align-top font-mono text-xs">
                            {last ? formatDate(last.performedAt) : "—"}
                            {last ? (
                              <>
                                <span className="mt-0.5 block font-sans text-[11px] text-muted-foreground">
                                  {last.performedBy}
                                </span>
                                {valueLine ? (
                                  <span className="mt-0.5 block font-sans text-[11px] text-muted-foreground">
                                    {valueLine}
                                  </span>
                                ) : null}
                              </>
                            ) : null}
                          </td>
                          <td className="px-3 py-3 align-top">
                            {standCell(r, last)}
                            <button
                              type="button"
                              className="mt-1 text-[12.5px] font-semibold text-primary hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                openRecord(r);
                              }}
                              data-testid={`reprocessing-record-${r.code}`}
                            >
                              {t("actions.record")}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </ListPageShell>
      </main>

      <Dialog open={!!releaseTarget} onOpenChange={(o) => !o && setReleaseTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("release.title")}</DialogTitle>
            <DialogDescription>
              {releaseTarget
                ? `${releaseTarget.batchNumber} · ${releaseTarget.inventoryNumber}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["released", t("release.released")],
                ["released_with_conditions", t("release.conditional")],
                ["rejected", t("release.rejected")],
              ] as const
            ).map(([val, label]) => (
              <Button
                key={val}
                type="button"
                size="sm"
                variant={result === val ? "default" : "outline"}
                onClick={() => setResult(val)}
              >
                {label}
              </Button>
            ))}
          </div>
          {(result === "released_with_conditions" || result === "rejected") && (
            <div className="space-y-1">
              <Label htmlFor="rel-note">
                {result === "released_with_conditions"
                  ? t("release.noteRequired")
                  : t("release.noteOptional")}
              </Label>
              <Textarea id="rel-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReleaseTarget(null)}>
              {t("actions.cancel")}
            </Button>
            <Button
              type="button"
              disabled={busy || (result === "released_with_conditions" && !note.trim())}
              onClick={() => void submitRelease()}
            >
              {t("actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!recordTarget} onOpenChange={(o) => !o && setRecordTarget(null)}>
        <DialogContent className="max-w-md" data-testid="reprocessing-record-dialog">
          <DialogHeader>
            <DialogTitle>{t("record.title")}</DialogTitle>
            <DialogDescription>
              {recordTarget
                ? [recordTarget.label, recordTarget.limitText ? `${t("limit")} ${recordTarget.limitText}` : null]
                    .filter(Boolean)
                    .join(" · ")
                : ""}
            </DialogDescription>
          </DialogHeader>
          {recordTarget ? (
            <div className="space-y-3">
              {recordTarget.scope === "equipment" ? (
                <div className="space-y-1">
                  <Label htmlFor="rec-device">{t("record.device")}</Label>
                  <select
                    id="rec-device"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={recDeviceId}
                    onChange={(e) => setRecDeviceId(e.target.value)}
                    data-testid="reprocessing-record-device"
                  >
                    <option value="">
                      {list.equipment.length === 0
                        ? t("record.deviceEmpty")
                        : t("record.devicePlaceholder")}
                    </option>
                    {list.equipment.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.inventoryNumber} · {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {recordNeedsSite(recordTarget) ? (
                <div className="space-y-1">
                  <Label htmlFor="rec-site">{t("record.site")}</Label>
                  <select
                    id="rec-site"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={recSiteId}
                    onChange={(e) => setRecSiteId(e.target.value)}
                    data-testid="reprocessing-record-site"
                  >
                    <option value="">{t("record.sitePlaceholder")}</option>
                    {list.sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {recordTarget.cadence === "per_batch" ? (
                <div className="space-y-1">
                  <Label htmlFor="rec-batch">{t("record.batch")}</Label>
                  <select
                    id="rec-batch"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={recBatchId}
                    onChange={(e) => setRecBatchId(e.target.value)}
                    data-testid="reprocessing-record-batch"
                  >
                    <option value="">{t("record.batchPlaceholder")}</option>
                    {list.batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.batchNumber} · {b.equipmentLabel || b.inventoryNumber || "—"}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="rec-date">{t("record.performedAt")}</Label>
                  <Input
                    id="rec-date"
                    type="date"
                    value={recDate}
                    onChange={(e) => setRecDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rec-passed">{t("record.passed")}</Label>
                  <select
                    id="rec-passed"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={recPassed}
                    onChange={(e) => setRecPassed(e.target.value as "" | "yes" | "no")}
                  >
                    <option value="">{t("record.passedNone")}</option>
                    <option value="yes">{t("record.passedYes")}</option>
                    <option value="no">{t("record.passedNo")}</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="rec-value">
                  {t("record.value")}
                  {recordTarget.unit ? ` (${recordTarget.unit})` : ""}
                </Label>
                <Input id="rec-value" value={recValue} onChange={(e) => setRecValue(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rec-note">{t("record.note")}</Label>
                <Textarea id="rec-note" value={recNote} onChange={(e) => setRecNote(e.target.value)} rows={2} />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRecordTarget(null)}>
              {t("actions.cancel")}
            </Button>
            <Button
              type="button"
              disabled={busy || recordInvalid}
              onClick={() => void submitRecord()}
              data-testid="reprocessing-record-save"
            >
              {t("actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
