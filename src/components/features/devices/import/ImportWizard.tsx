"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3 | 4 | 5;

type MappingColumn = {
  index: number;
  header: string;
  field: string | null;
};

type MappingSheet = {
  name: string;
  siteId: string | null;
  newSiteName: string | null;
  headerRowIndex?: number;
  columns: MappingColumn[];
  skippedTitleRows?: string[];
};

type JobDetail = {
  job: {
    id: string;
    fileName: string;
    status: string;
    mapping: {
      sheets: MappingSheet[];
    } | null;
    stats: Record<string, number> | null;
  };
  rows: {
    id: string;
    quality: string | null;
    modelMatch: string | null;
    outcome: string | null;
    note: string | null;
    normalized: Record<string, unknown> | null;
    raw?: unknown;
    sheet: string | null;
    rowNo: number;
  }[];
};

type SiteOption = { id: string; name: string };

const FIELD_KEYS = [
  "bezeichnung",
  "typ",
  "hersteller",
  "seriennummer",
  "inventarnummer",
  "loskennung",
  "anschaffung",
  "standort",
  "verantwortlich",
  "letzte_stk",
  "letzte_mtk",
  "naechste_pruefung",
  "gtin",
  "bemerkung",
  "ignorieren",
] as const;

const SAMPLE_FILES = [
  { id: "praxis-1", labelKey: "samplePraxis1" as const, fileName: "praxis-1-hausarzt-bestandsverzeichnis.xlsx" },
  { id: "praxis-2", labelKey: "samplePraxis2" as const, fileName: "praxis-2-mvz-geraeteliste.xlsx" },
  { id: "praxis-3", labelKey: "samplePraxis3" as const, fileName: "praxis-3-chirurgie-inventar.csv" },
];

type UnclassifiedModel = {
  id: string;
  manufacturer: string;
  modelName: string;
  tradeName: string | null;
};

type Finish = {
  neu: number;
  aktualisiert: number;
  klaer: number;
  modelle: number;
  rest: number;
  faellig?: number;
  job: { id: string; stats: Record<string, number> | null };
};

const STEPS = ["file", "mapping", "preview", "commit"] as const;

function AmpelChip({ quality }: { quality: string | null }) {
  const q = quality || "";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        q === "gruen" && "bg-[var(--chip-mtk-bg)] text-[var(--chip-mtk-fg)]",
        q === "gelb" && "bg-[var(--chip-rad-bg)] text-[var(--chip-rad-fg)]",
        q === "rot" && "bg-[color-mix(in_srgb,var(--red)_14%,transparent)] text-[var(--red)]",
        !q && "bg-muted text-muted-foreground",
      )}
    >
      {q === "gruen" ? "Grün" : q === "gelb" ? "Gelb" : q === "rot" ? "Rot" : "—"}
    </span>
  );
}

function MatchChip({ match }: { match: string | null }) {
  const m = match || "";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        m === "exact" && "bg-[var(--chip-mtk-bg)] text-[var(--chip-mtk-fg)]",
        m === "fuzzy" && "bg-[var(--chip-stk-bg)] text-[var(--chip-stk-fg)]",
        m === "new" && "bg-muted text-muted-foreground",
        !m || m === "none" ? "bg-muted text-muted-foreground" : null,
      )}
    >
      {m || "—"}
    </span>
  );
}

function samplesForColumn(
  rows: JobDetail["rows"],
  sheetName: string,
  colIndex: number,
  limit = 3,
): string {
  const values: string[] = [];
  const sheetRows = rows
    .filter((r) => r.sheet === sheetName)
    .sort((a, b) => a.rowNo - b.rowNo);
  for (const r of sheetRows) {
    const raw = Array.isArray(r.raw) ? (r.raw as unknown[]) : null;
    if (!raw) continue;
    const s = raw[colIndex] == null ? "" : String(raw[colIndex]).trim();
    if (!s || values.includes(s)) continue;
    values.push(s);
    if (values.length >= limit) break;
  }
  return values.length ? values.join(" · ") : "—";
}

export function ImportWizard() {
  const t = useTranslations("pages.inventoryImport");
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [filter, setFilter] = useState<string>("rows");
  const [finish, setFinish] = useState<Finish | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteDone, setInviteDone] = useState(false);
  const [unclassified, setUnclassified] = useState<UnclassifiedModel[]>([]);
  const [classifiedIds, setClassifiedIds] = useState<string[]>([]);

  const loadDetail = useCallback(async (id: string, quality?: string) => {
    const q = quality && quality !== "alle" ? `?quality=${quality}` : "";
    const res = await fetch(`/api/imports/${id}${q}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || res.statusText);
    }
    const data = (await res.json()) as JobDetail;
    setDetail(data);
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/sites");
        if (!res.ok) return;
        const data = (await res.json()) as { sites?: SiteOption[] };
        if (!cancelled) setSites(data.sites ?? []);
      } catch {
        /* ignore — site dropdown stays empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fieldLabel = (field: string | null) => {
    if (!field || field === "ignorieren") return t("ignore");
    if ((FIELD_KEYS as readonly string[]).includes(field)) {
      return t(`fields.${field as (typeof FIELD_KEYS)[number]}`);
    }
    return field;
  };

  const onSiteChange = async (sheetName: string, siteId: string) => {
    if (!jobId || !detail?.job.mapping) return;
    const isNew = siteId === "__new__";
    setBusy(true);
    setError(null);
    try {
      const sheets = detail.job.mapping.sheets.map((s) =>
        s.name === sheetName
          ? {
              name: s.name,
              siteId: isNew ? null : siteId,
              newSiteName: isNew ? s.name : null,
            }
          : { name: s.name },
      );
      const res = await fetch(`/api/imports/${jobId}/mapping`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sheets }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || res.statusText);
      }
      await loadDetail(jobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onFieldChange = async (sheetName: string, colIndex: number, field: string) => {
    if (!jobId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/imports/${jobId}/mapping`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sheets: [
            {
              name: sheetName,
              columns: [{ index: colIndex, field: field === "ignorieren" ? "ignorieren" : field, byUser: true }],
            },
          ],
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || res.statusText);
      }
      await loadDetail(jobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onUpload = async (file: File) => {
    setBusy(true);
    setError(null);
    setFileName(file.name);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("template", "excel_14");
      const res = await fetch("/api/imports", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || res.statusText);
      }
      const data = await res.json();
      setJobId(data.job.id);
      await loadDetail(data.job.id);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onSample = async (sampleId: string, downloadName: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/imports/samples/${sampleId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || res.statusText);
      }
      const blob = await res.blob();
      const file = new File([blob], downloadName, { type: blob.type || "application/octet-stream" });
      await onUpload(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const onPreview = async () => {
    if (!jobId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/imports/${jobId}/preview`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || res.statusText);
      }
      await loadDetail(jobId);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onCommit = async () => {
    if (!jobId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/imports/${jobId}/commit`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || res.statusText);
      }
      const data = await res.json();
      setFinish(data as Finish);
      setStep(5);
      setClassifiedIds([]);
      try {
        const modelsRes = await fetch(`/api/imports/${jobId}/unclassified-models`);
        if (modelsRes.ok) {
          const body = (await modelsRes.json()) as { models?: UnclassifiedModel[] };
          setUnclassified(body.models ?? []);
        } else {
          setUnclassified([]);
        }
      } catch {
        setUnclassified([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onClassifyQuick = async (modelId: string, annex: "anlage1" | "anlage2" | "none") => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/catalog/models/${modelId}/classify-quick`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ annex, confirmed: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || res.statusText);
      }
      setClassifiedIds((prev) => [...prev, modelId]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onInvite = async () => {
    if (!jobId || !inviteEmail.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/imports/${jobId}/invite-partner`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          newProvider: { name: inviteName || inviteEmail, email: inviteEmail },
          rightsTemplate: "inspect_and_maintain",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || res.statusText);
      }
      setInviteDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const stats = detail?.job.stats || finish?.job.stats || null;
  const rows = detail?.rows || [];
  const hasPruefungColumns = (detail?.job.mapping?.sheets || []).some((s) =>
    s.columns.some((c) => c.field === "letzte_stk" || c.field === "letzte_mtk"),
  );
  const pruefungHintCount = rows.reduce((n, r) => {
    const list = (r.normalized as { pruefungen?: unknown[] } | null)?.pruefungen;
    return n + (Array.isArray(list) ? list.length : 0);
  }, 0);
  const modelNewCount = stats?.modelNew ?? rows.filter((r) => r.modelMatch === "new").length;
  const previewRows =
    filter === "modelNew" ? rows.filter((r) => r.modelMatch === "new") : rows;

  const stepIndex = step === 5 ? 4 : step;

  return (
    <div className="p-work" data-testid="import-wizard">
      <main className="p-main">
      <ListPageShell
        variant="compose"
        title={t("title")}
        description={t("subtitle")}
        headerExtra={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" size="sm" asChild>
              <Link href="/devices">← {t("back")}</Link>
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/devices/import/jobs">{t("jobsTitle")}</Link>
            </Button>
          </div>
        }
        contentClassName="space-y-6"
      >
        {/* Step rail */}
        <nav
          className="flex flex-wrap gap-2"
          data-testid="import-steps"
          aria-label={t("title")}
        >
          {STEPS.map((key, i) => {
            const n = (i + 1) as Step;
            const done = stepIndex > n || step === 5;
            const cur = step === n;
            return (
              <div
                key={key}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  cur && "border-primary bg-primary text-primary-foreground",
                  done && !cur && "border-[color-mix(in_srgb,var(--green)_35%,var(--border))] bg-[color-mix(in_srgb,var(--green)_10%,transparent)] text-[var(--green)]",
                  !cur && !done && "border-border bg-muted/40 text-muted-foreground",
                )}
                aria-current={cur ? "step" : undefined}
              >
                <span
                  className={cn(
                    "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold",
                    cur && "bg-primary-foreground/20 text-primary-foreground",
                    done && !cur && "bg-[color-mix(in_srgb,var(--green)_18%,transparent)]",
                    !cur && !done && "bg-background",
                  )}
                >
                  {done && !cur ? <Check className="h-3 w-3" /> : n}
                </span>
                {t(`steps.${key}`)}
              </div>
            );
          })}
        </nav>

        {error ? (
          <div
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {/* Step 1 — File */}
        {step === 1 ? (
          <section className="space-y-4" data-testid="import-step-file">
            <div
              className={cn(
                "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/30",
                busy && "pointer-events-none opacity-60",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) void onUpload(f);
              }}
            >
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border">
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <p className="text-base font-medium">{t("drop")}</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">{t("fileHint")}</p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                  data-testid="import-choose-file"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  {t("emptyImport")}
                </Button>
                <Button type="button" variant="outline" size="sm" asChild>
                  <a href="/api/imports/template.xlsx">
                    <Download className="h-4 w-4" />
                    {t("downloadTemplate")}
                  </a>
                </Button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="sr-only"
                disabled={busy}
                data-testid="import-file-input"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUpload(f);
                }}
              />
              {fileName ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  <FileSpreadsheet className="mr-1 inline h-3.5 w-3.5" />
                  {fileName}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("samplesTitle")}
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {SAMPLE_FILES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    disabled={busy}
                    data-testid={`import-sample-${s.id}`}
                    className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-60"
                    onClick={() => void onSample(s.id, s.fileName)}
                  >
                    <span className="font-medium">{t(s.labelKey)}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* Step 2 — Mapping */}
        {step === 2 && detail ? (
          <section className="space-y-5" data-testid="import-step-mapping">
            {(detail.job.mapping?.sheets || []).map((sheet, sheetIdx) => {
              const recognized = sheet.columns.filter(
                (c) => c.field && c.field !== "ignorieren",
              ).length;
              const rowCount = rows.filter((r) => r.sheet === sheet.name).length;
              const headerRow = (sheet.headerRowIndex ?? 0) + 1;
              const siteValue = sheet.siteId || (sheet.newSiteName ? "__new__" : "");
              return (
                <div key={sheet.name} className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t("siteLabel")}
                    </p>
                    <Select
                      value={siteValue || undefined}
                      disabled={busy}
                      onValueChange={(v) => void onSiteChange(sheet.name, v)}
                    >
                      <SelectTrigger className="max-w-md" data-testid="import-site-select">
                        <SelectValue placeholder={t("sitePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {sites.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="__new__">
                          {t("newSite")}
                          {sheet.newSiteName ? ` · ${sheet.newSiteName}` : ` · ${sheet.name}`}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground" title={fileName || undefined}>
                      {t("sheetMeta", { n: sheetIdx + 1, rows: rowCount })}
                      {fileName ? (
                        <span className="ml-2 text-xs opacity-70">· {fileName}</span>
                      ) : null}
                    </p>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-border">
                    <div className="border-b border-border bg-muted/30 px-4 py-3">
                      <p className="text-sm font-semibold">
                        {t("mappingSheet", { n: sheetIdx + 1 })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("recognisedMeta", {
                          mapped: recognized,
                          total: sheet.columns.length,
                          header: headerRow,
                        })}
                      </p>
                    </div>
                    {sheet.skippedTitleRows?.length ? (
                      <p className="border-b border-border px-4 py-2 font-mono text-[11px] text-muted-foreground">
                        {t("skipped")}: {sheet.skippedTitleRows.join(" · ")}
                      </p>
                    ) : null}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="px-4 py-2.5 font-medium">{t("colFile")}</th>
                            <th className="px-4 py-2.5 font-medium">{t("colMapped")}</th>
                            <th className="px-4 py-2.5 font-medium">{t("colSample")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sheet.columns.map((c) => {
                            const value = c.field && c.field !== "ignorieren" ? c.field : "ignorieren";
                            return (
                              <tr key={c.index} className="border-b border-border/70 last:border-0">
                                <td className="px-4 py-2.5 font-medium">{c.header || "—"}</td>
                                <td className="px-4 py-2.5">
                                  <Select
                                    value={value}
                                    disabled={busy}
                                    onValueChange={(v) => void onFieldChange(sheet.name, c.index, v)}
                                  >
                                    <SelectTrigger
                                      className="h-8 max-w-[220px]"
                                      data-testid={`import-field-${sheet.name}-${c.index}`}
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {FIELD_KEYS.map((key) => (
                                        <SelectItem key={key} value={key}>
                                          {key === "ignorieren" ? t("ignore") : fieldLabel(key)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="px-4 py-2.5 text-muted-foreground">
                                  {samplesForColumn(rows, sheet.name, c.index)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setStep(1)}>
                {t("backStep")}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void onPreview()}
                data-testid="import-preview-btn"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("toPreview")}
              </Button>
            </div>
          </section>
        ) : null}

        {/* Step 3 — Preview */}
        {step === 3 && detail ? (
          <section className="space-y-4" data-testid="import-step-preview">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{t("previewTitle")}</h2>
                <p className="text-sm text-muted-foreground">{t("ampelHint")}</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setStep(2)}>
                  {t("backStep")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => setStep(4)}
                  data-testid="import-to-commit"
                >
                  {t("toCommit")}
                </Button>
              </div>
            </div>

            <div className="space-y-2" data-testid="import-preview-hints">
              {!hasPruefungColumns || pruefungHintCount === 0 ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                  {t("hintNoDuties")}
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  {t("hintDutiesCount", { count: pruefungHintCount })}
                </div>
              )}
              {modelNewCount > 0 ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                  {t("hintNewModels", { count: modelNewCount })}
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(
                [
                  ["rows", stats?.deviceRows ?? stats?.rows, null],
                  ["green", stats?.green, "gruen"],
                  ["yellow", stats?.yellow, "gelb"],
                  ["red", stats?.red, "rot"],
                  ["new", stats?.new, null],
                  ["updated", stats?.updated, null],
                  ["exact", stats?.modelExact, null],
                  ["fuzzy", stats?.modelFuzzy, null],
                  ["modelNew", modelNewCount, null],
                  ["duplicates", stats?.duplicatesInFile, null],
                  ["released", stats?.releasedHits, null],
                ] as const
              ).map(([key, val, qualityFilter]) => (
                <button
                  key={key}
                  type="button"
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    filter === key
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-card hover:bg-muted/30",
                    key === "green" && "border-l-4 border-l-[var(--green)]",
                    key === "yellow" && "border-l-4 border-l-[var(--warn)]",
                    key === "red" && "border-l-4 border-l-[var(--red)]",
                    key === "modelNew" && modelNewCount > 0 && "border-l-4 border-l-amber-500",
                  )}
                  onClick={() => {
                    setFilter(key);
                    if (key === "modelNew") {
                      if (jobId) void loadDetail(jobId);
                      return;
                    }
                    if (jobId && qualityFilter) void loadDetail(jobId, qualityFilter);
                    else if (jobId) void loadDetail(jobId);
                  }}
                >
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t(`tiles.${key}`)}
                  </div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                    {val ?? "—"}
                  </div>
                </button>
              ))}
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2.5 font-medium">{t("ampel")}</th>
                      <th className="px-3 py-2.5 font-medium">{t("name")}</th>
                      <th className="px-3 py-2.5 font-medium">{t("serial")}</th>
                      <th className="px-3 py-2.5 font-medium">{t("inventory")}</th>
                      <th className="px-3 py-2.5 font-medium">{t("siteCol")}</th>
                      <th className="px-3 py-2.5 font-medium">{t("model")}</th>
                      <th className="px-3 py-2.5 font-medium">{t("missing")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                          —
                        </td>
                      </tr>
                    ) : (
                      previewRows.slice(0, 100).map((r) => {
                        const n = (r.normalized || {}) as Record<string, string>;
                        return (
                          <tr key={r.id} className="border-b border-border/70 last:border-0">
                            <td className="px-3 py-2.5">
                              <AmpelChip quality={r.quality} />
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="font-medium">{n.bezeichnung || "—"}</div>
                              <div className="text-xs text-muted-foreground">
                                {r.sheet} · Z.{r.rowNo}
                                {n.hersteller || n.typ
                                  ? ` · ${[n.hersteller, n.typ].filter(Boolean).join(" ")}`
                                  : ""}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 font-mono text-xs">
                              {n.seriennummer || n.loskennung || "—"}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-xs">
                              {n.inventarnummer || "—"}
                            </td>
                            <td className="px-3 py-2.5 text-xs">
                              {n.standort || n.raum || "—"}
                            </td>
                            <td className="px-3 py-2.5">
                              <MatchChip match={r.modelMatch} />
                            </td>
                            <td className="max-w-[240px] px-3 py-2.5 text-xs text-muted-foreground">
                              {r.note || "—"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : null}

        {/* Step 4 — Commit */}
        {step === 4 ? (
          <section className="space-y-4" data-testid="import-step-commit">
            <div className="rounded-xl border border-border bg-muted/20 p-5">
              <h2 className="text-base font-semibold">{t("commitTitle")}</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("commitHint")}</p>
              <div className="mt-3 space-y-2" data-testid="import-commit-hints">
                {!hasPruefungColumns || pruefungHintCount === 0 ? (
                  <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                    {t("hintNoDuties")}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("hintDutiesCount", { count: pruefungHintCount })}
                  </p>
                )}
                {modelNewCount > 0 ? (
                  <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                    {t("hintNewModels", { count: modelNewCount })}
                  </p>
                ) : null}
              </div>
              {stats ? (
                <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("tiles.rows")}</dt>
                    <dd className="text-xl font-semibold tabular-nums">
                      {stats.deviceRows ?? stats.rows}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("tiles.green")}</dt>
                    <dd className="text-xl font-semibold tabular-nums text-[var(--green)]">
                      {stats.green}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("tiles.yellow")}</dt>
                    <dd className="text-xl font-semibold tabular-nums text-[var(--warn)]">
                      {stats.yellow}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("tiles.red")}</dt>
                    <dd className="text-xl font-semibold tabular-nums text-[var(--red)]">
                      {stats.red}
                    </dd>
                  </div>
                </dl>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setStep(3)}>
                  {t("backStep")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => void onCommit()}
                  data-testid="import-commit-btn"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t("commit")}
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        {/* Finish */}
        {step === 5 && finish ? (
          <section className="space-y-4" data-testid="import-finish">
            <div>
              <h2 className="text-base font-semibold">{t("finishTitle")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("finishSummary", { neu: finish.neu, aktualisiert: finish.aktualisiert })}
              </p>
              <p
                className={cn(
                  "mt-1 text-sm",
                  (finish.faellig ?? finish.job.stats?.faellig ?? 0) > 0
                    ? "text-muted-foreground"
                    : "text-amber-800 dark:text-amber-200",
                )}
                data-testid="import-finish-duties"
              >
                {(finish.faellig ?? finish.job.stats?.faellig ?? 0) > 0
                  ? t("finishDuties", {
                      count: finish.faellig ?? finish.job.stats?.faellig ?? 0,
                    })
                  : t("finishDutiesNone")}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Link
                href="/devices?tab=klaerliste"
                className="group rounded-xl border border-border p-4 transition-colors hover:border-primary hover:bg-primary/5"
              >
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("finishKlar")}
                </div>
                <div className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
                  {finish.klaer}
                </div>
              </Link>
              <div className="rounded-xl border border-border p-4">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("finishModels")}
                </div>
                <div className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
                  {Math.max(0, unclassified.length - classifiedIds.length)}
                </div>
                {unclassified.length > 0 ? (
                  <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm" data-testid="import-classify-list">
                    {unclassified.map((m) => {
                      const done = classifiedIds.includes(m.id);
                      return (
                        <li key={m.id} className="rounded-md border border-border/70 px-2 py-2">
                          <div className="font-medium">
                            {m.tradeName || m.modelName}
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              · {m.manufacturer}
                            </span>
                          </div>
                          {done ? (
                            <p className="mt-1 text-xs text-[var(--green)]">{t("classifyDone")}</p>
                          ) : (
                            <div className="mt-2 flex flex-wrap gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={busy}
                                onClick={() => void onClassifyQuick(m.id, "anlage1")}
                              >
                                {t("classifyAnlage1")}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={busy}
                                onClick={() => void onClassifyQuick(m.id, "anlage2")}
                              >
                                {t("classifyAnlage2")}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                disabled={busy}
                                onClick={() => void onClassifyQuick(m.id, "none")}
                              >
                                {t("classifyNone")}
                              </Button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">{t("classifyDone")}</p>
                )}
              </div>
              <div className="rounded-xl border border-border p-4">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("finishPartner")}
                </div>
                {inviteDone ? (
                  <p className="mt-3 text-sm text-[var(--green)]">{t("inviteSent")}</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    <Input
                      placeholder={t("partnerName")}
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                    />
                    <Input
                      placeholder={t("partnerEmail")}
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      data-testid="import-invite-email"
                    />
                    <Button type="button" size="sm" disabled={busy} onClick={() => void onInvite()}>
                      {t("sendInvite")}
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {finish.rest > 0 ? (
                <Button type="button" variant="outline" size="sm" asChild>
                  <a href={`/api/imports/${finish.job.id}/rest.csv`}>{t("downloadRest")}</a>
                </Button>
              ) : null}
              <Button type="button" size="sm" asChild>
                <Link href="/devices">{t("toDevices")}</Link>
              </Button>
            </div>
          </section>
        ) : null}
      </ListPageShell>
      </main>
    </div>
  );
}
