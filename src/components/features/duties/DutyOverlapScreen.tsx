"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useDutyOverlap } from "@/components/hooks/duties/useDutyOverlap";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

  if (!list.canView) {
    return (
      <div className="p-work" data-testid="duty-overlap-denied">
        <main className="p-main">
          <ListPageShell title={t("title")} description={t("denied")}>
            <p className="text-sm text-muted-foreground">{t("denied")}</p>
          </ListPageShell>
        </main>
      </div>
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
        <ListPageShell title={t("title")} description={t("description")}>
          <section
            className="mb-6 rounded-lg border border-l-4 border-l-blue-600 bg-background p-4"
            data-testid="duty-overlap-form"
          >
            <h2 className="text-sm font-semibold">{t("form.title")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{t("form.hint")}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="ov-device" className="text-[11px] uppercase tracking-wide">
                  {t("form.device")}
                </Label>
                <select
                  id="ov-device"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={deviceInstanceId}
                  onChange={(e) => setDeviceInstanceId(e.target.value)}
                  data-testid="duty-overlap-device"
                  disabled={list.devices.length === 0}
                >
                  <option value="">
                    {list.devices.length === 0
                      ? t("form.deviceEmpty")
                      : t("form.devicePlaceholder")}
                  </option>
                  {list.devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.inventoryNumber} · {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ov-covered" className="text-[11px] uppercase tracking-wide">
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
                <Label htmlFor="ov-satisfied" className="text-[11px] uppercase tracking-wide">
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
                <Label htmlFor="ov-reason" className="text-[11px] uppercase tracking-wide">
                  {t("form.reason")} <span className="text-red-600">*</span>
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
                <Label htmlFor="ov-at" className="text-[11px] uppercase tracking-wide">
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
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : list.decisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-muted/50 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
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
          )}
        </ListPageShell>
      </main>
    </div>
  );
}
