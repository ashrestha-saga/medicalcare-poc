"use client";

import { useTranslations } from "next-intl";
import { AccessDenied } from "@/components/features/shared/AccessDenied";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { TestEquipmentClassGuideDialog } from "@/components/features/partner/test-equipment/TestEquipmentClassGuideDialog";
import { useTestEquipmentDetail } from "@/components/hooks/partner/test-equipment/useTestEquipmentDetail";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/Loading";

export function TestEquipmentDetailScreen({ id }: { id: string }) {
  const t = useTranslations("pruefpartner");
  const tCommon = useTranslations("common");
  const d = useTestEquipmentDetail(id);

  if (!d.loading && !d.item && d.error) {
    return (
      <div className="p-work" data-testid="test-equipment-detail">
        <main className="p-main">
          <ListPageShell title={t("testEquipmentTitle")} description={d.error}>
            <Button type="button" variant="outline" onClick={d.back}>
              {t("testEquipmentBack")}
            </Button>
          </ListPageShell>
        </main>
      </div>
    );
  }

  if (!d.loading && !d.canManage && !d.item) {
    return (
      <AccessDenied
        title={t("testEquipmentTitle")}
        description={tCommon("denied")}
        hint={tCommon("contactAdmin")}
        testId="test-equipment-detail-denied"
      />
    );
  }

  return (
    <div className="p-work" data-testid="test-equipment-detail">
      <main className="p-main">
        <ListPageShell
          title={d.item?.label ?? t("testEquipmentTitle")}
          description={d.item?.classLabel ?? d.item?.classCode ?? t("testEquipmentDetailIntro")}
          headerExtra={
            <div className="flex flex-wrap gap-2">
              <TestEquipmentClassGuideDialog
                classes={d.classes}
                highlightCode={d.classCode || undefined}
              />
              <Button type="button" variant="outline" onClick={d.back}>
                {t("testEquipmentBack")}
              </Button>
              {d.canManage ? (
                <Button type="button" disabled={d.busy} onClick={() => void d.save()}>
                  {t("testEquipmentSave")}
                </Button>
              ) : null}
            </div>
          }
        >
          {d.loading ? (
            <div className="p-wait py-10">
              <Spinner />
            </div>
          ) : d.error && !d.item ? (
            <Alert variant="destructive">
              <AlertDescription>{d.error}</AlertDescription>
            </Alert>
          ) : (
            <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="text-xs">{t("testEquipmentClass")}</Label>
                <select
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
                  value={d.classCode}
                  disabled={!d.canManage}
                  onChange={(e) => d.setClassCode(e.target.value)}
                >
                  {d.classes.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">{t("testEquipmentLabel")}</Label>
                <Input
                  className="mt-1"
                  value={d.label}
                  disabled={!d.canManage}
                  onChange={(e) => d.setLabel(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">{t("testEquipmentSerial")}</Label>
                <Input
                  className="mt-1"
                  value={d.serialNumber}
                  disabled={!d.canManage}
                  onChange={(e) => d.setSerialNumber(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">{t("testEquipmentCalibratedUntil")}</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={d.calibratedUntil}
                  disabled={!d.canManage}
                  onChange={(e) => d.setCalibratedUntil(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">{t("testEquipmentTraceability")}</Label>
                <Input
                  className="mt-1"
                  value={d.traceabilityRef}
                  disabled={!d.canManage}
                  onChange={(e) => d.setTraceabilityRef(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">{t("testEquipmentAssignee")}</Label>
                <select
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
                  value={d.assignedMembershipId}
                  disabled={!d.canManage}
                  onChange={(e) => d.setAssignedMembershipId(e.target.value)}
                >
                  <option value="">{t("testEquipmentUnassigned")}</option>
                  {d.assignees.map((a) => (
                    <option key={a.membershipId} value={a.membershipId}>
                      {a.name} ({a.appRole})
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                <Checkbox
                  id="te-active"
                  checked={d.active}
                  disabled={!d.canManage}
                  onCheckedChange={(v) => d.setActive(v === true)}
                />
                <Label htmlFor="te-active" className="text-sm font-normal">
                  {t("testEquipmentActive")}
                </Label>
              </div>
              {d.item ? (
                <p className="sm:col-span-2 text-xs text-muted-foreground">
                  {t("testEquipmentStatusLabel")}:{" "}
                  {d.item.status === "due"
                    ? t("testEquipmentStatusDue")
                    : d.item.status === "lapsed"
                      ? t("testEquipmentStatusLapsed")
                      : d.item.status === "inactive"
                        ? t("testEquipmentStatusInactive")
                        : t("testEquipmentStatusOk")}
                </p>
              ) : null}
            </div>
          )}
        </ListPageShell>
      </main>
    </div>
  );
}
