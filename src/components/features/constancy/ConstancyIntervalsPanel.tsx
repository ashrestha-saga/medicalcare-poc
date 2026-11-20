"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { MissingCadenceRow } from "@/components/hooks/constancy/useConstancyCadence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ConstancyCadenceDTO } from "@/interfaces";
import { captureDefaultsForObject } from "@/lib/constancy/captureDefaults";
import {
  guidelineCadenceMismatch,
  suggestFromDefaultCadence,
} from "@/lib/constancy/suggestCadence";
import { useSessionStore } from "@/store/sessionStore";
import { cn } from "@/lib/utils";

function displayDeterminedBy(name: string | null | undefined): string {
  const raw = name?.trim() ?? "";
  if (!raw) return "—";
  if (/^user[-_]/i.test(raw) || /^c[a-z0-9]{20,}$/i.test(raw)) return "—";
  return raw;
}

type TableRow =
  | { kind: "open"; key: string; row: ConstancyCadenceDTO }
  | { kind: "missing"; key: string; row: MissingCadenceRow };

type CaptureMode = "device_protocol" | "manual_measurement" | "visual";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split("-");
  if (!y || !m || !d) return day;
  return `${d}.${m}.${y}`;
}

type ListApi = {
  missing: MissingCadenceRow[];
  open: ConstancyCadenceDTO[];
  loading: boolean;
  determine: (input: {
    deviceInstanceId: string;
    constancyObjectCode: string;
    intervalValue: number;
    intervalUnit: "months" | "years" | "working_days";
    basisText: string;
    determinedAt: string;
    captureMode?: CaptureMode;
    protocolSource?: string | null;
    referenceValuesJson?:
      | Array<{
          name: string;
          value: number;
          unit: string;
          tolerancePct?: number | null;
        }>
      | { visualCheckpoints: string[] }
      | null;
  }) => Promise<boolean>;
};

/** Intervals / takt determination (mockup tab 1). */
export function ConstancyIntervalsPanel({ list }: { list: ListApi }) {
  const t = useTranslations("pages.constancyCadence");
  const user = useSessionStore((s) => s.user);

  const [target, setTarget] = useState<MissingCadenceRow | null>(null);
  const [intervalValue, setIntervalValue] = useState("");
  const [intervalUnit, setIntervalUnit] = useState<"months" | "years" | "working_days">("months");
  const [basisText, setBasisText] = useState("");
  const [determinedAt, setDeterminedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [hintCadence, setHintCadence] = useState<string | null>(null);
  const [intervalError, setIntervalError] = useState<string | null>(null);
  const [captureMode, setCaptureMode] = useState<CaptureMode>("device_protocol");
  const [protocolSource, setProtocolSource] = useState("");
  const [refName, setRefName] = useState("");
  const [refValue, setRefValue] = useState("");
  const [refUnit, setRefUnit] = useState("");
  const [refTol, setRefTol] = useState("");
  const [refs, setRefs] = useState<
    Array<{ name: string; value: number; unit: string; tolerancePct?: number | null }>
  >([]);
  const [busy, setBusy] = useState(false);

  const total = list.missing.length + list.open.length;
  const roleLabel =
    user?.role === "superadmin"
      ? t("role.superadmin")
      : user?.role === "device_admin"
        ? t("role.device_admin")
        : user?.role === "security_officer"
          ? t("role.security_officer")
          : user?.role === "user"
            ? t("role.user")
            : null;
  const determinedByDisplay = user?.name
    ? roleLabel
      ? `${user.name} · ${roleLabel}`
      : user.name
    : "—";

  const unitLabel = (unit: string) => {
    if (unit === "years") return t("unit.years");
    if (unit === "months") return t("unit.months");
    if (unit === "working_days") return t("unit.working_days");
    return unit;
  };

  const modeChip = (mode: CaptureMode | null | undefined) => {
    if (mode === "manual_measurement") return "B";
    if (mode === "visual") return "C";
    return "A";
  };

  const rows = useMemo<TableRow[]>(() => {
    const missing: TableRow[] = list.missing.map((row) => ({
      kind: "missing",
      key: `m:${row.deviceInstanceId}:${row.constancyObjectCode}`,
      row,
    }));
    const open: TableRow[] = list.open.map((row) => ({
      kind: "open",
      key: `o:${row.id}`,
      row,
    }));
    return [...missing, ...open].sort((a, b) => {
      const invA = a.row.inventoryNumber ?? "";
      const invB = b.row.inventoryNumber ?? "";
      if (invA !== invB) return invA.localeCompare(invB);
      const la = a.row.constancyObjectLabel ?? a.row.constancyObjectCode;
      const lb = b.row.constancyObjectLabel ?? b.row.constancyObjectCode;
      return la.localeCompare(lb);
    });
  }, [list.missing, list.open]);

  const openDetermine = (row: MissingCadenceRow) => {
    const sug = suggestFromDefaultCadence(row.defaultCadence);
    const cap = captureDefaultsForObject(row.constancyObjectCode);
    setTarget(row);
    setIntervalValue(String(sug.intervalValue));
    setIntervalUnit(sug.intervalUnit);
    setHintCadence(row.defaultCadence);
    setBasisText(
      row.defaultCadence ? t("form.basisPrefill", { cadence: row.defaultCadence }) : "",
    );
    setDeterminedAt(new Date().toISOString().slice(0, 10));
    setCaptureMode(cap.captureMode);
    setProtocolSource(cap.protocolSource ?? "");
    setRefs(
      (cap.referenceValues ?? []).map((r) => ({
        name: r.name,
        value: r.value,
        unit: r.unit,
        tolerancePct: r.tolerancePct ?? null,
      })),
    );
    setRefName("");
    setRefValue("");
    setRefUnit("");
    setRefTol("");
    setIntervalError(null);
  };

  const cancelDetermine = () => {
    setTarget(null);
    setHintCadence(null);
  };

  const addRef = () => {
    const name = refName.trim();
    const value = Number(refValue);
    const unit = refUnit.trim();
    if (!name || !unit || !Number.isFinite(value)) return;
    const tol = refTol.trim() ? Number(refTol) : null;
    setRefs((prev) => [
      ...prev,
      {
        name,
        value,
        unit,
        tolerancePct: tol != null && Number.isFinite(tol) ? tol : null,
      },
    ]);
    setRefName("");
    setRefValue("");
    setRefUnit("");
    setRefTol("");
  };

  const submit = async () => {
    if (!target || !basisText.trim()) return;
    const value = Number(intervalValue);
    if (!Number.isFinite(value) || value < 1) return;
    const mismatch = guidelineCadenceMismatch(target.defaultCadence, intervalUnit);
    if (mismatch.mismatch && mismatch.guideline && mismatch.suggestedUnit) {
      setIntervalError(
        t("form.unitMismatch", {
          guideline: mismatch.guideline,
          unit: unitLabel(mismatch.suggestedUnit),
        }),
      );
      return;
    }
    if (captureMode === "manual_measurement" && refs.length === 0) {
      setIntervalError(t("form.refsRequired"));
      return;
    }
    setIntervalError(null);
    setBusy(true);
    try {
      const visualDefaults = captureDefaultsForObject(target.constancyObjectCode);
      const ok = await list.determine({
        deviceInstanceId: target.deviceInstanceId,
        constancyObjectCode: target.constancyObjectCode,
        intervalValue: Math.floor(value),
        intervalUnit,
        basisText: basisText.trim(),
        determinedAt,
        captureMode,
        protocolSource:
          captureMode === "device_protocol" ? protocolSource.trim() || null : null,
        referenceValuesJson:
          captureMode === "manual_measurement"
            ? refs
            : captureMode === "visual" && visualDefaults.visualCheckpoints?.length
              ? { visualCheckpoints: visualDefaults.visualCheckpoints }
              : null,
      });
      if (ok) cancelDetermine();
    } finally {
      setBusy(false);
    }
  };

  const intervalOk = Number.isFinite(Number(intervalValue)) && Number(intervalValue) >= 1;

  return (
    <div data-testid="constancy-intervals-panel">
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-lg border bg-background p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("kpi.objects")}
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{total}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("kpi.objectsHint")}</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("kpi.missing")}
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{list.missing.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("kpi.missingHint")}</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("kpi.set")}
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{list.open.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("kpi.setHint")}</p>
        </div>
      </div>

      {list.missing.length > 0 ? (
        <div
          className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100"
          data-testid="constancy-missing-banner"
        >
          <p className="font-medium">{t("banner.title", { count: list.missing.length })}</p>
          <p className="mt-0.5 text-amber-900/80 dark:text-amber-100/80">{t("banner.body")}</p>
        </div>
      ) : null}

      {target ? (
        <section
          className="mb-4 rounded-lg border border-l-4 border-l-blue-600 bg-background p-4 shadow-sm"
          data-testid="constancy-determine-form"
        >
          <h2 className="text-sm font-semibold">
            {t("form.title", {
              object: target.constancyObjectLabel ?? target.constancyObjectCode,
            })}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {target.inventoryNumber}
            {target.deviceLabel ? ` · ${target.deviceLabel}` : ""}
          </p>

          {hintCadence ? (
            <p className="mt-3 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {t("form.hint", { cadence: hintCadence })}
            </p>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="kt-val" className="text-[11px] uppercase tracking-wide">
                {t("form.interval")}
              </Label>
              <Input
                id="kt-val"
                type="number"
                min={1}
                value={intervalValue}
                onChange={(e) => setIntervalValue(e.target.value)}
                data-testid="constancy-interval"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="kt-unit" className="text-[11px] uppercase tracking-wide">
                {t("form.unit")}
              </Label>
              <select
                id="kt-unit"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={intervalUnit}
                onChange={(e) => {
                  setIntervalUnit(e.target.value as "months" | "years" | "working_days");
                  setIntervalError(null);
                }}
                data-testid="constancy-unit"
              >
                <option value="working_days">{t("unit.working_days")}</option>
                <option value="months">{t("unit.months")}</option>
                <option value="years">{t("unit.years")}</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="kt-mode" className="text-[11px] uppercase tracking-wide">
                {t("form.captureMode")}
              </Label>
              <select
                id="kt-mode"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={captureMode}
                onChange={(e) => setCaptureMode(e.target.value as CaptureMode)}
                data-testid="constancy-capture-mode"
              >
                <option value="device_protocol">{t("form.modeA")}</option>
                <option value="manual_measurement">{t("form.modeB")}</option>
                <option value="visual">{t("form.modeC")}</option>
              </select>
              <p className="text-xs text-muted-foreground">{t("form.captureModeHint")}</p>
            </div>
            {captureMode === "device_protocol" ? (
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="kt-proto" className="text-[11px] uppercase tracking-wide">
                  {t("form.protocolSource")}
                </Label>
                <Input
                  id="kt-proto"
                  value={protocolSource}
                  onChange={(e) => setProtocolSource(e.target.value)}
                  placeholder={t("form.protocolSourcePlaceholder")}
                  data-testid="constancy-protocol-source"
                />
              </div>
            ) : null}
            {captureMode === "manual_measurement" ? (
              <div className="space-y-2 sm:col-span-2" data-testid="constancy-refs">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("form.refs")}
                </p>
                {refs.length > 0 ? (
                  <ul className="divide-y rounded-md border text-sm">
                    {refs.map((r) => (
                      <li key={r.name} className="flex flex-wrap items-center gap-2 px-3 py-2">
                        <span className="font-medium">{r.name}</span>
                        <span className="text-muted-foreground">
                          {r.value} {r.unit}
                          {r.tolerancePct != null ? ` ±${r.tolerancePct}%` : ""}
                        </span>
                        <button
                          type="button"
                          className="ml-auto text-xs text-destructive hover:underline"
                          onClick={() => setRefs((prev) => prev.filter((x) => x.name !== r.name))}
                        >
                          {t("actions.removeRef")}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-4">
                  <Input
                    placeholder={t("form.refName")}
                    value={refName}
                    onChange={(e) => setRefName(e.target.value)}
                  />
                  <Input
                    type="number"
                    step="any"
                    placeholder={t("form.refValue")}
                    value={refValue}
                    onChange={(e) => setRefValue(e.target.value)}
                  />
                  <Input
                    placeholder={t("form.refUnit")}
                    value={refUnit}
                    onChange={(e) => setRefUnit(e.target.value)}
                  />
                  <Input
                    type="number"
                    step="any"
                    placeholder={t("form.refTol")}
                    value={refTol}
                    onChange={(e) => setRefTol(e.target.value)}
                  />
                </div>
                <Button type="button" size="sm" variant="outline" onClick={addRef}>
                  {t("actions.addRef")}
                </Button>
              </div>
            ) : null}
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="kt-basis" className="text-[11px] uppercase tracking-wide">
                {t("form.basis")} <span className="text-red-600">*</span>
              </Label>
              <Textarea
                id="kt-basis"
                value={basisText}
                onChange={(e) => setBasisText(e.target.value)}
                rows={3}
                placeholder={t("form.basisPlaceholder")}
                data-testid="constancy-basis"
              />
              <p className="text-xs text-muted-foreground">{t("form.basisNote")}</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="kt-by" className="text-[11px] uppercase tracking-wide">
                {t("form.determinedBy")}
              </Label>
              <Input id="kt-by" value={determinedByDisplay} readOnly disabled />
            </div>
            <div className="space-y-1">
              <Label htmlFor="kt-at" className="text-[11px] uppercase tracking-wide">
                {t("form.determinedAt")}
              </Label>
              <Input
                id="kt-at"
                type="date"
                value={determinedAt}
                onChange={(e) => setDeterminedAt(e.target.value)}
                data-testid="constancy-determined-at"
              />
            </div>
          </div>

          {intervalError ? (
            <p className="mt-2 text-xs text-destructive" data-testid="constancy-unit-error">
              {intervalError}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy || !basisText.trim() || !intervalOk}
              onClick={() => void submit()}
              data-testid="constancy-save"
            >
              {t("actions.save")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={cancelDetermine}
              data-testid="constancy-cancel"
            >
              {t("actions.cancel")}
            </Button>
          </div>
        </section>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-muted/50 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 font-medium">{t("col.device")}</th>
              <th className="px-3 py-2.5 font-medium">{t("col.object")}</th>
              <th className="px-3 py-2.5 font-medium">{t("col.interval")}</th>
              <th className="px-3 py-2.5 font-medium">{t("col.basis")}</th>
              <th className="px-3 py-2.5 font-medium">{t("col.determined")}</th>
            </tr>
          </thead>
          <tbody>
            {list.loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-muted-foreground">
                  {t("loading")}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-muted-foreground">
                  {t("empty")}
                </td>
              </tr>
            ) : (
              rows.map((item) => {
                if (item.kind === "open") {
                  const c = item.row;
                  return (
                    <tr key={item.key} className="border-t" data-testid={`cadence-${c.id}`}>
                      <td className="px-3 py-3 align-top">
                        <p className="font-medium">{c.inventoryNumber ?? "—"}</p>
                        {c.deviceLabel ? (
                          <p className="text-xs text-muted-foreground">{c.deviceLabel}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p>{c.constancyObjectLabel ?? c.constancyObjectCode}</p>
                        <span className="mt-0.5 inline-flex rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium">
                          {modeChip(c.captureMode)}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        {c.intervalValue} {unitLabel(c.intervalUnit)}
                      </td>
                      <td className="max-w-[220px] px-3 py-3 align-top text-muted-foreground">
                        {c.basisText}
                      </td>
                      <td className="px-3 py-3 align-top text-muted-foreground">
                        {displayDeterminedBy(c.determinedBy)}, {formatDate(c.determinedAt)}
                      </td>
                    </tr>
                  );
                }

                const m = item.row;
                const active =
                  target?.deviceInstanceId === m.deviceInstanceId &&
                  target?.constancyObjectCode === m.constancyObjectCode;
                return (
                  <tr
                    key={item.key}
                    className={cn("border-t", active && "bg-blue-50/50 dark:bg-blue-950/20")}
                    data-testid={`missing-cadence-${m.dutyId}`}
                  >
                    <td className="px-3 py-3 align-top">
                      <p className="font-medium">{m.inventoryNumber}</p>
                      {m.deviceLabel ? (
                        <p className="text-xs text-muted-foreground">{m.deviceLabel}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 align-top">
                      {m.constancyObjectLabel ?? m.constancyObjectCode}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <p className="font-medium text-amber-700 dark:text-amber-400">{t("notSet")}</p>
                      {m.defaultCadence ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {t("notSetHint", { cadence: m.defaultCadence })}
                        </p>
                      ) : null}
                    </td>
                    <td className="max-w-[220px] px-3 py-3 align-top text-muted-foreground">
                      {m.defaultCadence
                        ? t("form.basisPrefill", { cadence: m.defaultCadence })
                        : "—"}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <p className="text-muted-foreground">—</p>
                      <button
                        type="button"
                        className="mt-0.5 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                        data-testid={`set-cadence-${m.dutyId}`}
                        onClick={() => openDetermine(m)}
                      >
                        {t("actions.set")}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
