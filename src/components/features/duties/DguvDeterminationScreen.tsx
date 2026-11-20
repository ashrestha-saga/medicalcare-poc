"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AccessDenied } from "@/components/features/shared/AccessDenied";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";

type PendingRow = {
  dutyId: string;
  deviceInstanceId: string;
  inventoryNumber: string;
  kind: string;
  tradeName: string | null;
};

type State = "own_check" | "covered_by_stk" | "not_applicable";

export function DguvDeterminationScreen() {
  const t = useTranslations("pages.dguvDetermination");
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, setState] = useState<State>("own_check");
  const [intervalMonths, setIntervalMonths] = useState("24");
  const [gbuRef, setGbuRef] = useState("GBU-");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ pending: PendingRow[] }>("/api/duties/dguv/determine");
      setPending(res.pending);
      setDenied(false);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 401)) setDenied(true);
      else toast.error(e instanceof ApiError ? e.message : t("errLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (selected.size === 0) {
      toast.error(t("errSelect"));
      return;
    }
    setBusy(true);
    try {
      const body = {
        deviceIds: [...selected],
        determination: {
          state,
          intervalMonths: state === "own_check" ? Number(intervalMonths) : null,
          gbuRef,
        },
      };
      const res = await api<{
        results: unknown[];
        errors: Array<{ deviceId: string; message: string }>;
      }>("/api/duties/dguv/determine", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (res.errors.length) {
        toast.error(t("errPartial", { n: res.errors.length }));
      } else {
        toast.success(t("ok", { n: res.results.length }));
      }
      setSelected(new Set());
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("errSave"));
    } finally {
      setBusy(false);
    }
  };

  if (denied) {
    return <AccessDenied title={t("denied")} testId="dguv-determination-denied" />;
  }

  return (
    <ListPageShell
      title={t("title")}
      description={t("subtitle")}
      testId="dguv-determination-page"
    >
      {loading ? (
        <p className="text-sm text-muted-foreground" data-testid="dguv-det-loading">
          …
        </p>
      ) : null}
      <section className="mb-6 rounded-lg border border-l-4 border-l-primary bg-background p-4">
        <h2 className="text-sm font-semibold">{t("form.title")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("form.hint")}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide">{t("form.state")}</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={state}
              onChange={(e) => setState(e.target.value as State)}
              data-testid="dguv-det-state"
            >
              <option value="own_check">{t("form.ownCheck")}</option>
              <option value="covered_by_stk">{t("form.coveredStk")}</option>
              <option value="not_applicable">{t("form.notApplicable")}</option>
            </select>
          </div>
          {state === "own_check" ? (
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wide">{t("form.interval")}</Label>
              <Input
                type="number"
                min={1}
                value={intervalMonths}
                onChange={(e) => setIntervalMonths(e.target.value)}
                data-testid="dguv-det-interval"
              />
            </div>
          ) : null}
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs uppercase tracking-wide">{t("form.gbu")}</Label>
            <Input
              value={gbuRef}
              onChange={(e) => setGbuRef(e.target.value)}
              data-testid="dguv-det-gbu"
            />
            <p className="text-xs text-muted-foreground">{t("form.refHint")}</p>
          </div>
        </div>
        <div className="mt-4">
          <Button type="button" onClick={() => void submit()} disabled={busy} data-testid="dguv-det-save">
            {busy ? t("form.saving") : t("form.save")}
          </Button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">
          {t("list.title", { n: pending.length })}
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("list.empty")}</p>
        ) : (
          <ul className="divide-y rounded-md border" data-testid="dguv-det-list">
            {pending.map((row) => (
              <li key={row.deviceInstanceId}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={selected.has(row.deviceInstanceId)}
                    onChange={() => toggle(row.deviceInstanceId)}
                    data-testid={`dguv-det-row-${row.inventoryNumber}`}
                  />
                  <span className="font-mono text-xs">{row.inventoryNumber}</span>
                  <span className="truncate text-muted-foreground">
                    {row.tradeName ?? "—"}
                    {row.kind === "equipment" ? ` · ${t("list.equipment")}` : ""}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ListPageShell>
  );
}
