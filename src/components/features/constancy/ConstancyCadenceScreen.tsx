"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  useConstancyCadence,
  type MissingCadenceRow,
} from "@/components/hooks/constancy/useConstancyCadence";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ConstancyCadenceDTO } from "@/interfaces";
import { suggestFromDefaultCadence } from "@/lib/constancy/suggestCadence";
import { useSessionStore } from "@/store/sessionStore";
import { cn } from "@/lib/utils";

type TableRow =
  | { kind: "open"; key: string; row: ConstancyCadenceDTO }
  | { kind: "missing"; key: string; row: MissingCadenceRow };

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split("-");
  if (!y || !m || !d) return day;
  return `${d}.${m}.${y}`;
}

export function ConstancyCadenceScreen() {
  const t = useTranslations("pages.constancyCadence");
  const list = useConstancyCadence();
  const user = useSessionStore((s) => s.user);

  const [target, setTarget] = useState<MissingCadenceRow | null>(null);
  const [intervalValue, setIntervalValue] = useState("");
  const [intervalUnit, setIntervalUnit] = useState<"months" | "years">("months");
  const [basisText, setBasisText] = useState("");
  const [determinedAt, setDeterminedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [hintCadence, setHintCadence] = useState<string | null>(null);
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
    return unit;
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

  if (!list.canView) {
    return (
      <div className="p-work" data-testid="constancy-denied">
        <main className="p-main">
          <ListPageShell title={t("title")} description={t("denied")}>
            <p className="text-sm text-muted-foreground">{t("denied")}</p>
          </ListPageShell>
        </main>
      </div>
    );
  }

  const openDetermine = (row: MissingCadenceRow) => {
    const sug = suggestFromDefaultCadence(row.defaultCadence);
    setTarget(row);
    setIntervalValue(String(sug.intervalValue));
    setIntervalUnit(sug.intervalUnit);
    setHintCadence(row.defaultCadence);
    setBasisText(
      row.defaultCadence
        ? t("form.basisPrefill", { cadence: row.defaultCadence })
        : "",
    );
    setDeterminedAt(new Date().toISOString().slice(0, 10));
  };

  const cancelDetermine = () => {
    setTarget(null);
    setHintCadence(null);
  };

  const submit = async () => {
    if (!target || !basisText.trim()) return;
    const value = Number(intervalValue);
    if (!Number.isFinite(value) || value < 1) return;
    setBusy(true);
    try {
      const ok = await list.determine({
        deviceInstanceId: target.deviceInstanceId,
        constancyObjectCode: target.constancyObjectCode,
        intervalValue: Math.floor(value),
        intervalUnit,
        basisText: basisText.trim(),
        determinedAt,
      });
      if (ok) cancelDetermine();
    } finally {
      setBusy(false);
    }
  };

  const intervalOk = Number.isFinite(Number(intervalValue)) && Number(intervalValue) >= 1;

  return (
    <div className="p-work" data-testid="constancy-cadence-page">
      <main className="p-main">
        <ListPageShell title={t("title")} description={t("description")}>
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
              <p className="font-medium">
                {t("banner.title", { count: list.missing.length })}
              </p>
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
                    onChange={(e) => setIntervalUnit(e.target.value as "months" | "years")}
                    data-testid="constancy-unit"
                  >
                    <option value="months">{t("unit.months")}</option>
                    <option value="years">{t("unit.years")}</option>
                  </select>
                </div>
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
                        <tr
                          key={item.key}
                          className="border-t"
                          data-testid={`cadence-${c.id}`}
                        >
                          <td className="px-3 py-3 align-top">
                            <p className="font-medium">{c.inventoryNumber ?? "—"}</p>
                            {c.deviceLabel ? (
                              <p className="text-xs text-muted-foreground">{c.deviceLabel}</p>
                            ) : null}
                          </td>
                          <td className="px-3 py-3 align-top">
                            {c.constancyObjectLabel ?? c.constancyObjectCode}
                          </td>
                          <td className="px-3 py-3 align-top">
                            {c.intervalValue} {unitLabel(c.intervalUnit)}
                          </td>
                          <td className="max-w-[220px] px-3 py-3 align-top text-muted-foreground">
                            {c.basisText}
                          </td>
                          <td className="px-3 py-3 align-top text-muted-foreground">
                            {c.determinedBy}, {formatDate(c.determinedAt)}
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
                          <p className="font-medium text-amber-700 dark:text-amber-400">
                            {t("notSet")}
                          </p>
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
        </ListPageShell>
      </main>
    </div>
  );
}
