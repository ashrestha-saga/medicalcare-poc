"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { TestEquipmentDTO, TestEquipmentStatus } from "@/interfaces/pruefpartner";
import { AccessDenied } from "@/components/features/shared/AccessDenied";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { TestEquipmentClassGuideDialog } from "@/components/features/partner/test-equipment/TestEquipmentClassGuideDialog";
import {
  useTestEquipmentList,
  type TestEquipmentFilter,
} from "@/components/hooks/partner/test-equipment/useTestEquipmentList";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/Loading";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { cn } from "@/lib/utils";

function statusLabel(
  t: ReturnType<typeof useTranslations<"pruefpartner">>,
  status: TestEquipmentStatus,
): string {
  switch (status) {
    case "due":
      return t("testEquipmentStatusDue");
    case "lapsed":
      return t("testEquipmentStatusLapsed");
    case "inactive":
      return t("testEquipmentStatusInactive");
    default:
      return t("testEquipmentStatusOk");
  }
}

function StatusChip({ status }: { status: TestEquipmentStatus }) {
  const t = useTranslations("pruefpartner");
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
        status === "ok" && "bg-emerald-50 text-emerald-800",
        status === "due" && "bg-amber-50 text-amber-900",
        status === "lapsed" && "bg-red-50 text-red-800",
        status === "inactive" && "bg-muted text-muted-foreground",
      )}
    >
      {statusLabel(t, status)}
    </span>
  );
}

function FilterChip({
  id,
  active,
  label,
  count,
  onClick,
}: {
  id: TestEquipmentFilter;
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      onClick={onClick}
      data-testid={`test-equipment-filter-${id}`}
    >
      {label}
      {typeof count === "number" ? ` (${count})` : ""}
    </Button>
  );
}

export function TestEquipmentScreen() {
  const t = useTranslations("pruefpartner");
  const tCommon = useTranslations("common");
  const { checkPermission, permissionsLoading } = usePermissions();
  const canView =
    checkPermission("testequipment:manage") || checkPermission("console:organisation:view");
  const eq = useTestEquipmentList();

  if (!permissionsLoading && !canView) {
    return (
      <AccessDenied
        title={t("testEquipmentTitle")}
        description={tCommon("denied")}
        hint={tCommon("contactAdmin")}
        testId="test-equipment-denied"
      />
    );
  }

  const summary = eq.data?.summary;

  return (
    <div className="p-work" data-testid="test-equipment-page">
      <main className="p-main">
        <ListPageShell
          title={t("testEquipmentPageTitle")}
          description={t("testEquipmentPageIntro")}
          headerExtra={
            <div className="flex flex-wrap items-center gap-2">
              <TestEquipmentClassGuideDialog classes={eq.data?.classes ?? []} />
              {eq.data?.canManage ? (
                <Button
                  type="button"
                  onClick={() => eq.setCreateOpen(true)}
                  data-testid="test-equipment-add"
                >
                  {t("testEquipmentAdd")}
                </Button>
              ) : null}
            </div>
          }
        >
          {eq.error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{eq.error}</AlertDescription>
            </Alert>
          ) : null}

          {summary && (summary.lapsed > 0 || summary.due > 0) ? (
            <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-950">
              <AlertDescription>
                {t("testEquipmentCalibrationBanner", {
                  lapsed: summary.lapsed,
                  due: summary.due,
                })}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="mb-4 flex flex-wrap gap-2">
            <FilterChip
              id="all"
              active={eq.filter === "all"}
              label={t("testEquipmentFilterAll")}
              count={summary?.total}
              onClick={() => eq.setFilter("all")}
            />
            <FilterChip
              id="active"
              active={eq.filter === "active"}
              label={t("testEquipmentFilterActive")}
              count={summary?.active}
              onClick={() => eq.setFilter("active")}
            />
            <FilterChip
              id="due"
              active={eq.filter === "due"}
              label={t("testEquipmentFilterDue")}
              count={summary?.due}
              onClick={() => eq.setFilter("due")}
            />
            <FilterChip
              id="lapsed"
              active={eq.filter === "lapsed"}
              label={t("testEquipmentFilterLapsed")}
              count={summary?.lapsed}
              onClick={() => eq.setFilter("lapsed")}
            />
            <FilterChip
              id="inactive"
              active={eq.filter === "inactive"}
              label={t("testEquipmentFilterInactive")}
              count={summary?.inactive}
              onClick={() => eq.setFilter("inactive")}
            />
          </div>

          <div className="mb-4 flex flex-wrap gap-3">
            <Input
              value={eq.keyword}
              onChange={(e) => eq.setKeyword(e.target.value)}
              placeholder={t("testEquipmentSearch")}
              className="max-w-sm"
              data-testid="test-equipment-search"
            />
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={eq.classFilter}
              onChange={(e) => eq.setClassFilter(e.target.value)}
              data-testid="test-equipment-class-filter"
            >
              <option value="">{t("testEquipmentFilterAllClasses")}</option>
              {(eq.data?.classes ?? []).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {eq.loading ? (
            <div className="p-wait py-10">
              <Spinner />
            </div>
          ) : eq.filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("testEquipmentEmpty")}</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {eq.filtered.map((item) => (
                <EquipmentRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </ListPageShell>
      </main>

      <Dialog open={eq.createOpen} onOpenChange={eq.setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("testEquipmentAdd")}</DialogTitle>
            <DialogDescription>{t("testEquipmentCreateHint")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="text-xs">{t("testEquipmentClass")}</Label>
              <select
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={eq.classCode}
                onChange={(e) => eq.setClassCode(e.target.value)}
              >
                {(eq.data?.classes ?? []).map((c) => (
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
                value={eq.label}
                onChange={(e) => eq.setLabel(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">{t("testEquipmentSerial")}</Label>
              <Input
                className="mt-1"
                value={eq.serialNumber}
                onChange={(e) => eq.setSerialNumber(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">{t("testEquipmentCalibratedUntil")}</Label>
              <Input
                className="mt-1"
                type="date"
                value={eq.calibratedUntil}
                onChange={(e) => eq.setCalibratedUntil(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">{t("testEquipmentTraceability")}</Label>
              <Input
                className="mt-1"
                value={eq.traceabilityRef}
                onChange={(e) => eq.setTraceabilityRef(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => eq.setCreateOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              disabled={eq.busy || !eq.label.trim()}
              onClick={() => void eq.addItem()}
            >
              {t("testEquipmentAdd")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EquipmentRow({ item }: { item: TestEquipmentDTO }) {
  const t = useTranslations("pruefpartner");
  return (
    <li>
      <Link
        href={`/partner/test-equipment/${encodeURIComponent(item.id)}`}
        className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
        data-testid={`test-equipment-row-${item.id}`}
      >
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.label}</span>
            <StatusChip status={item.status} />
          </div>
          <p className="text-xs text-muted-foreground">
            {item.classLabel ?? item.classCode}
            {item.serialNumber ? ` · ${item.serialNumber}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {item.calibratedUntil
              ? `${t("testEquipmentCalibratedUntil")}: ${item.calibratedUntil}`
              : t("testEquipmentNoCalibration")}
            {item.assigneeName ? ` · ${t("testEquipmentAssignee")}: ${item.assigneeName}` : ""}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{t("testEquipmentOpen")}</span>
      </Link>
    </li>
  );
}
