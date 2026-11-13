"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { AccessDenied } from "@/components/features/shared/AccessDenied";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { FaultPhotoField } from "@/components/features/repairs/FaultPhotoField";
import { RepairDeviceSearchSelect } from "@/components/features/repairs/RepairDeviceSearchSelect";
import { useRepairDeviceOptions } from "@/components/hooks/repairs/useRepairDeviceOptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/apiClient";
import { useQueryParam } from "@/lib/navigation/searchParams";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { useSessionStore } from "@/store/sessionStore";
import { toast } from "@/store/toastStore";

type Consequence = "out_of_service" | "restricted" | "usable";

/**
 * Clinic fault report (E75) — posts to /api/book-entries/fault.
 * Optional `?deviceId=` prefill from Assignments / device book.
 */
export function FaultReportScreen() {
  const t = useTranslations("repairs.fault");
  const { checkPermission, permissionsLoading } = usePermissions();
  const canCreate = checkPermission("requests:create");
  const deviceIdParam = useQueryParam("deviceId");
  const { options, loading: devicesLoading } = useRepairDeviceOptions();
  const reporterName = useSessionStore((s) => s.user?.name)?.trim() || "—";

  const [deviceInstanceId, setDeviceInstanceId] = useState(() => deviceIdParam ?? "");
  const [description, setDescription] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [consequenceCode, setConsequenceCode] = useState<Consequence>("restricted");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  if (permissionsLoading) {
    return (
      <div className="p-work" data-testid="fault-report-loading">
        <main className="p-main">
          <ListPageShell variant="compose" title={t("title")}>
            <p className="text-sm text-muted-foreground">…</p>
          </ListPageShell>
        </main>
      </div>
    );
  }

  if (!canCreate) {
    return <AccessDenied title={t("title")} testId="fault-report-denied" />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setResult(null);
    try {
      const res = await api<{
        entryId: string;
        serviceRequestReference: string | null;
        clarificationId: string | null;
      }>("/api/book-entries/fault", {
        method: "POST",
        body: JSON.stringify({
          deviceInstanceId: deviceInstanceId.trim(),
          description: description.trim(),
          occurredAt,
          consequenceCode,
          photoDataUrl: photoDataUrl || null,
        }),
      });
      const msg = res.serviceRequestReference
        ? t("createdOrder", { ref: res.serviceRequestReference })
        : t("createdTriage");
      setResult(msg);
      toast.success(msg);
      setPhotoDataUrl(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-work" data-testid="fault-report-page">
      <main className="p-main">
        <ListPageShell
          variant="compose"
          title={t("title")}
          description={t("subtitle")}
          headerExtra={
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href="/requests" data-testid="fault-back-requests">
                {t("backToRequests")}
              </Link>
            </Button>
          }
        >
          <p className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {t("cardTitle")}
          </p>

          <form className="max-w-xl space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="fault-device">
                {t("device")} <span className="text-destructive">*</span>
              </Label>
              <RepairDeviceSearchSelect
                id="fault-device"
                options={options}
                value={deviceInstanceId}
                onChange={setDeviceInstanceId}
                loading={devicesLoading}
                required
                data-testid="fault-device-id"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fault-desc">
                {t("description")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fault-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("descriptionPlaceholder")}
                required
                data-testid="fault-description"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fault-date">{t("occurredAt")}</Label>
                <Input
                  id="fault-date"
                  type="date"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fault-by">{t("reportedBy")}</Label>
                <Input id="fault-by" value={reporterName} readOnly disabled />
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t("consequence")}</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {(
                  [
                    ["out_of_service", t("outOfService")],
                    ["restricted", t("restricted")],
                    ["usable", t("usable")],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="consequence"
                      checked={consequenceCode === value}
                      onChange={() => setConsequenceCode(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <FaultPhotoField value={photoDataUrl} onChange={setPhotoDataUrl} />

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button type="submit" disabled={saving} data-testid="fault-submit">
                {saving ? t("saving") : t("submit")}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/requests">{t("cancel")}</Link>
              </Button>
            </div>

            {result ? <p className="text-sm text-muted-foreground">{result}</p> : null}
          </form>
        </ListPageShell>
      </main>
    </div>
  );
}
