"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useDutyOverlap } from "@/components/hooks/duties/useDutyOverlap";
import { AccessDenied } from "@/components/features/shared/AccessDenied";
import { EmptyState } from "@/components/features/shared/EmptyState";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { PageLoading } from "@/components/features/shared/PageLoading";
import {
  AdminListCard,
  ResponsiveTableSwitch,
} from "@/components/features/shared/ResponsiveTableSwitch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type DutyPair = "dguv" | "stk";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split("-");
  if (!y || !m || !d) return day;
  return `${d}.${m}.${y}`;
}

export function DutyOverlapScreen() {
  const t = useTranslations("pages.dutyOverlap");
  const list = useDutyOverlap();

  const [deviceInstanceId, setDeviceInstanceId] = useState("");
  const [coveredDutyKey, setCoveredDutyKey] = useState<DutyPair>("dguv");
  const [satisfiedByDutyKey, setSatisfiedByDutyKey] = useState<DutyPair>("stk");
  const [reasonText, setReasonText] = useState("");
  const [decidedAt, setDecidedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Pending devices may not carry STK, so keep them selectable in the form.
  const deviceOptions = [
    ...list.devices,
    ...list.pending.filter((p) => !list.devices.some((d) => d.id === p.id)),
  ];

  if (!list.canView) {
    return (
      <AccessDenied
        title={t("title")}
        description={t("denied")}
        hint={t("denied")}
        testId="duty-overlap-denied"
      />
    );
  }

  const submit = async () => {
    if (!deviceInstanceId || !reasonText.trim()) return;
    if (coveredDutyKey === satisfiedByDutyKey) return;
    setBusy(true);
    try {
      const ok = await list.decide({
        deviceInstanceId,
        coveredDutyKey,
        satisfiedByDutyKey,
        reasonText: reasonText.trim(),
        decidedAt,
      });
      if (ok) {
        setReasonText("");
        setDeviceInstanceId("");
      }
    } finally {
      setBusy(false);
    }
  };

  const onRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      await list.revoke(id);
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="p-work" data-testid="duty-overlap-page">
      <main className="p-main">
        <ListPageShell variant="compose" title={t("title")} description={t("description")}>
          {list.pending.length > 0 ? (
            <section
              className="mb-6 rounded-lg border border-l-4 border-l-amber-500 bg-background p-4"
              data-testid="duty-overlap-pending"
            >
              <h2 className="text-sm font-semibold">
                {t("pending.title", { count: list.pending.length })}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">{t("pending.hint")}</p>
              <ul className="mt-3 divide-y rounded-md border">
                {list.pending.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50",
                        deviceInstanceId === d.id && "bg-muted/60",
                      )}
                      onClick={() => {
                        setDeviceInstanceId(d.id);
                        setCoveredDutyKey("dguv");
                        setSatisfiedByDutyKey("stk");
                      }}
                      data-testid={`duty-overlap-pending-${d.id}`}
                    >
                      <span className="font-mono text-xs">{d.inventoryNumber}</span>
                      <span className="truncate text-muted-foreground">{d.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section
            className="mb-6 rounded-lg border border-l-4 border-l-primary bg-background p-4"
            data-testid="duty-overlap-form"
          >
            <h2 className="text-sm font-semibold">{t("form.title")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{t("form.hint")}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="ov-device" className="text-xs uppercase tracking-wide">
                  {t("form.device")}
                </Label>
                <select
                  id="ov-device"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={deviceInstanceId}
                  onChange={(e) => setDeviceInstanceId(e.target.value)}
                  data-testid="duty-overlap-device"
                  disabled={deviceOptions.length === 0}
                >
                  <option value="">
                    {deviceOptions.length === 0
                      ? t("form.deviceEmpty")
                      : t("form.devicePlaceholder")}
                  </option>
                  {deviceOptions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.inventoryNumber} · {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ov-covered" className="text-xs uppercase tracking-wide">
                  {t("form.covered")}
                </Label>
                <select
                  id="ov-covered"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={coveredDutyKey}
                  onChange={(e) => setCoveredDutyKey(e.target.value as DutyPair)}
                  data-testid="duty-overlap-covered"
                >
                  <option value="dguv">DGUV</option>
                  <option value="stk">STK</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ov-satisfied" className="text-xs uppercase tracking-wide">
                  {t("form.satisfiedBy")}
                </Label>
                <select
                  id="ov-satisfied"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={satisfiedByDutyKey}
                  onChange={(e) => setSatisfiedByDutyKey(e.target.value as DutyPair)}
                  data-testid="duty-overlap-satisfied"
                >
                  <option value="stk">STK</option>
                  <option value="dguv">DGUV</option>
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="ov-reason" className="text-xs uppercase tracking-wide" required>
                  {t("form.reason")}
                </Label>
                <Textarea
                  id="ov-reason"
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  rows={3}
                  placeholder={t("form.reasonPlaceholder")}
                  data-testid="duty-overlap-reason"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ov-at" className="text-xs uppercase tracking-wide">
                  {t("form.decidedAt")}
                </Label>
                <Input
                  id="ov-at"
                  type="date"
                  value={decidedAt}
                  onChange={(e) => setDecidedAt(e.target.value)}
                  data-testid="duty-overlap-date"
                />
              </div>
            </div>

            {coveredDutyKey === satisfiedByDutyKey ? (
              <p className="mt-3 text-xs text-destructive" data-testid="duty-overlap-same-duty">
                {t("form.sameDuty")}
              </p>
            ) : null}

            <div className="mt-4">
              <Button
                type="button"
                disabled={
                  busy ||
                  !deviceInstanceId ||
                  !reasonText.trim() ||
                  coveredDutyKey === satisfiedByDutyKey
                }
                onClick={() => void submit()}
                data-testid="duty-overlap-save"
              >
                {t("actions.save")}
              </Button>
            </div>
          </section>

          {list.loading ? (
            <PageLoading label={t("loading")} />
          ) : list.decisions.length === 0 ? (
            <EmptyState>{t("empty")}</EmptyState>
          ) : (
            <ResponsiveTableSwitch
              table={
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-muted/50 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">{t("col.device")}</th>
                        <th className="px-3 py-2.5 font-medium">{t("col.coverage")}</th>
                        <th className="px-3 py-2.5 font-medium">{t("col.reason")}</th>
                        <th className="px-3 py-2.5 font-medium">{t("col.decided")}</th>
                        <th className="px-3 py-2.5 font-medium">{t("col.actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.decisions.map((d) => (
                        <tr key={d.id} className="border-t" data-testid={`overlap-${d.id}`}>
                          <td className="px-3 py-3 align-top font-mono text-xs">
                            {d.inventoryNumber ?? "—"}
                          </td>
                          <td className="px-3 py-3 align-top font-medium">
                            {d.coveredDutyKey} ← {d.satisfiedByDutyKey}
                          </td>
                          <td className="max-w-[240px] px-3 py-3 align-top text-muted-foreground">
                            {d.reasonText}
                          </td>
                          <td className="px-3 py-3 align-top text-muted-foreground">
                            {formatDate(d.decidedAt)}
                          </td>
                          <td className="px-3 py-3 align-top">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={revokingId === d.id}
                              onClick={() => void onRevoke(d.id)}
                              data-testid={`overlap-revoke-${d.id}`}
                            >
                              {t("actions.revoke")}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              }
              cards={list.decisions.map((d) => (
                <AdminListCard
                  key={d.id}
                  testId={`overlap-${d.id}`}
                  title={d.inventoryNumber ?? "—"}
                  subtitle={`${d.coveredDutyKey} ← ${d.satisfiedByDutyKey} · ${formatDate(d.decidedAt)}`}
                  actions={
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={revokingId === d.id}
                      onClick={() => void onRevoke(d.id)}
                      data-testid={`overlap-revoke-${d.id}`}
                    >
                      {t("actions.revoke")}
                    </Button>
                  }
                >
                  <p>{d.reasonText}</p>
                </AdminListCard>
              ))}
            />
          )}
        </ListPageShell>
      </main>
    </div>
  );
}
