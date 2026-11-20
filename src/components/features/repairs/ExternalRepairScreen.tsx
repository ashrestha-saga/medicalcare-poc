"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AccessDenied } from "@/components/features/shared/AccessDenied";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { RepairDeviceSearchSelect } from "@/components/features/repairs/RepairDeviceSearchSelect";
import { useRepairDeviceOptions } from "@/components/hooks/repairs/useRepairDeviceOptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/apiClient";
import { useQueryParam } from "@/lib/navigation/searchParams";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

const MEASURE_KEYS = [
  "repariert",
  "teil_getauscht",
  "software",
  "einstellung",
  "provisorisch",
  "nicht_reparabel",
] as const;

type MeasureKey = (typeof MEASURE_KEYS)[number];

function resultFromMeasure(measure: MeasureKey): "repaired" | "provisional" | "not_repairable" {
  if (measure === "nicht_reparabel") return "not_repairable";
  if (measure === "provisorisch") return "provisional";
  return "repaired";
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

/** E76 Fremdbericht — clinic external repair report. Optional `?deviceId=` prefill. */
export function ExternalRepairScreen() {
  const t = useTranslations("repairs.external");
  const { checkPermission, permissionsLoading } = usePermissions();
  const canCreate =
    checkPermission("inventory:update") || checkPermission("requests:approve");
  const deviceIdParam = useQueryParam("deviceId");
  const { options, loading: devicesLoading } = useRepairDeviceOptions();

  const [deviceInstanceId, setDeviceInstanceId] = useState(() => deviceIdParam ?? "");
  const [externalPerformer, setExternalPerformer] = useState("");
  const [performedAt, setPerformedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [measure, setMeasure] = useState<MeasureKey>("teil_getauscht");
  const [partsText, setPartsText] = useState("");
  const [resultText, setResultText] = useState("");
  const [reportFileName, setReportFileName] = useState("");
  const [reportDataUrl, setReportDataUrl] = useState<string | null>(null);
  const [createFollowUp, setCreateFollowUp] = useState(true);
  const [followUpSkippedReason, setFollowUpSkippedReason] = useState("");
  const [saving, setSaving] = useState(false);

  const measureLabels = useMemo(
    () =>
      ({
        repariert: t("measureRepaired"),
        teil_getauscht: t("measurePartReplaced"),
        software: t("measureSoftware"),
        einstellung: t("measureAdjustment"),
        provisorisch: t("measureProvisional"),
        nicht_reparabel: t("measureNotRepairable"),
      }) satisfies Record<MeasureKey, string>,
    [t],
  );

  if (permissionsLoading) {
    return (
      <div className="p-work" data-testid="external-repair-loading">
        <main className="p-main">
          <ListPageShell variant="compose" title={t("title")}>
            <p className="text-sm text-muted-foreground">…</p>
          </ListPageShell>
        </main>
      </div>
    );
  }

  if (!canCreate) {
    return <AccessDenied title={t("title")} testId="external-repair-denied" />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!createFollowUp && !followUpSkippedReason.trim()) {
      toast.error(t("skipReasonRequired"));
      return;
    }
    setSaving(true);
    try {
      await api("/api/maintenance-events", {
        method: "POST",
        body: JSON.stringify({
          deviceInstanceId: deviceInstanceId.trim(),
          performedAt,
          action: measureLabels[measure],
          resultText: resultText.trim(),
          externalPerformer: externalPerformer.trim(),
          result: resultFromMeasure(measure),
          partsText: partsText.trim() || null,
          reportDataUrl: reportDataUrl || null,
          createFollowUp,
          followUpSkippedReason: createFollowUp ? null : followUpSkippedReason.trim(),
        }),
      });
      toast.success(t("success"));
      setPartsText("");
      setResultText("");
      setReportFileName("");
      setReportDataUrl(null);
      setFollowUpSkippedReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-work" data-testid="external-repair-page">
      <main className="p-main">
        <ListPageShell
          variant="compose"
          title={t("title")}
          description={t("subtitle")}
          headerExtra={
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href="/requests" data-testid="external-back-requests">
                {t("backToRequests")}
              </Link>
            </Button>
          }
        >
          <form className="max-w-xl space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="ext-device">
                {t("device")} <span className="text-destructive">*</span>
              </Label>
              <RepairDeviceSearchSelect
                id="ext-device"
                options={options}
                value={deviceInstanceId}
                onChange={setDeviceInstanceId}
                loading={devicesLoading}
                required
                data-testid="external-device-id"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ext-by">
                  {t("externalPerformer")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ext-by"
                  value={externalPerformer}
                  onChange={(e) => setExternalPerformer(e.target.value)}
                  placeholder={t("companyPlaceholder")}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ext-date">{t("performedAt")}</Label>
                <Input
                  id="ext-date"
                  type="date"
                  value={performedAt}
                  onChange={(e) => setPerformedAt(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ext-measure">{t("action")}</Label>
                <select
                  id="ext-measure"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={measure}
                  onChange={(e) => setMeasure(e.target.value as MeasureKey)}
                >
                  {MEASURE_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {measureLabels[key]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ext-parts">{t("parts")}</Label>
                <Input
                  id="ext-parts"
                  value={partsText}
                  onChange={(e) => setPartsText(e.target.value)}
                  placeholder={t("partsPlaceholder")}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ext-result">{t("resultText")}</Label>
              <Input
                id="ext-result"
                value={resultText}
                onChange={(e) => setResultText(e.target.value)}
                placeholder={t("resultPlaceholder")}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ext-report">{t("reportFile")}</Label>
              <Input
                id="ext-report"
                type="file"
                accept="application/pdf,image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) {
                    setReportFileName("");
                    setReportDataUrl(null);
                    return;
                  }
                  const okType =
                    file.type === "application/pdf" || file.type.startsWith("image/");
                  if (!okType) {
                    toast.error(t("reportTypeError"));
                    e.target.value = "";
                    setReportFileName("");
                    setReportDataUrl(null);
                    return;
                  }
                  try {
                    setReportFileName(file.name);
                    setReportDataUrl(await fileToDataUrl(file));
                  } catch {
                    toast.error(t("reportReadError"));
                    setReportFileName("");
                    setReportDataUrl(null);
                  }
                }}
                data-testid="external-report-file"
              />
              {reportFileName ? (
                <p className="text-xs text-muted-foreground" data-testid="external-report-name">
                  {reportFileName}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">{t("reportHint")}</p>
              )}
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={createFollowUp}
                  onChange={(e) => setCreateFollowUp(e.target.checked)}
                  data-testid="external-follow-up"
                />
                {t("createFollowUp")}
              </label>
              <p className="text-sm text-muted-foreground">{t("followUpHint")}</p>
              <div className="space-y-1.5">
                <Label htmlFor="ext-skip-reason">{t("skipReason")}</Label>
                <Input
                  id="ext-skip-reason"
                  value={followUpSkippedReason}
                  onChange={(e) => setFollowUpSkippedReason(e.target.value)}
                  placeholder={t("skipReasonPlaceholder")}
                  required={!createFollowUp}
                  disabled={createFollowUp}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button type="submit" disabled={saving} data-testid="external-submit">
                {saving ? t("saving") : t("submit")}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/requests">{t("cancel")}</Link>
              </Button>
            </div>
          </form>
        </ListPageShell>
      </main>
    </div>
  );
}
