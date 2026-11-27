"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Printer, ScanLine } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { DeviceInstanceDetailDTO, DeviceInstanceDTO } from "@/interfaces";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InventoryBarcodeLabel } from "@/components/features/devices/labels/InventoryBarcodeLabel";
import { printInventoryLabels } from "@/components/features/devices/labels/printInventoryLabels";
import { formatDate } from "@/lib/format";
import { toInventoryLabel } from "@/lib/inventory/label";
import type { AppLocale } from "@/lib/locale";
import { ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { startServiceRequestFromDevice } from "@/lib/scan/startServiceRequestFromDevice";
import { UnlockDevicePanel } from "@/components/features/repairs/UnlockDevicePanel";
import { LoanerAssignPanel } from "@/components/features/repairs/LoanerAssignPanel";
import { toast } from "@/store/toastStore";
import { DeviceDutiesPanel } from "./DeviceDutiesPanel";
import { DeviceReportsCard } from "./DeviceReportsCard";
import { DeviceRoutineCard } from "./DeviceRoutineCard";

interface DeviceDetailProps {
  device: DeviceInstanceDTO | DeviceInstanceDetailDTO;
  canEdit?: boolean;
  onBack: () => void;
  onEdit?: () => void;
  /** Reload detail after loaner assign / unlock. */
  onRefresh?: () => void;
  completingDutyId?: string | null;
  onCompleteDuty?: (
    dutyId: string,
    input: { note: string; result: "passed" | "passed_with_conditions" | "failed" },
  ) => void;
  /** From notification deep link (`?focus=reports|duties`). */
  focus?: string | null;
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  const tCommon = useTranslations("common");
  return (
    <div className="grid gap-1 border-b border-border py-3 sm:grid-cols-[160px_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value?.trim() ? value : tCommon("dash")}</dd>
    </div>
  );
}

function isDetail(device: DeviceInstanceDTO | DeviceInstanceDetailDTO): device is DeviceInstanceDetailDTO {
  return "modelClassification" in device;
}

export function DeviceDetail({
  device,
  canEdit,
  onBack,
  onEdit,
  onRefresh,
  completingDutyId,
  onCompleteDuty,
  focus,
}: DeviceDetailProps) {
  const t = useTranslations("inventoryDetail");
  const tCommon = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const { checkPermission } = usePermissions();
  const canViewCatalog = checkPermission("catalog:view");
  const canCreateRequest = checkPermission("requests:create");
  const canShop = checkPermission("parts:request");
  const canErstanlage = checkPermission("inventory:update");
  const detail = isDetail(device) ? device : null;

  useEffect(() => {
    if (!focus) return;
    const id =
      focus === "reports"
        ? "device-detail-reports"
        : focus === "duties"
          ? "device-detail-duties"
          : null;
    if (!id) return;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [focus, device.id]);

  const modelClass = detail?.modelClassification;
  const modelHref = device.modelId && canViewCatalog ? `/catalog/${device.modelId}` : null;
  const hasProvisionalDuties = Boolean(detail?.duties?.some((d) => d.provisional));
  // Unit-scoped path only — model-wide reclassify is a separate admin flow.
  const provisionalNeedsErstanlage =
    hasProvisionalDuties &&
    (device.state === "draft" || device.state === "review" || device.state === "released");
  const provisionalStuckReleased = hasProvisionalDuties && device.state === "released";
  const openImportReviews = detail?.openImportReviews ?? [];
  const label = toInventoryLabel(device);
  const [requestBusy, setRequestBusy] = useState(false);

  const classLabels = (() => {
    const c = modelClass;
    if (!c) return "";
    return [
      c.softwareClass ? t("classSw", { class: c.softwareClass }) : null,
      c.annex1 ? t("classAnnex1") : null,
      c.annex2 ? t("classAnnex2") : null,
      c.radiation ? t("classRadiation") : null,
    ]
      .filter(Boolean)
      .join(" · ");
  })();

  const maintenanceStatusLabel = (() => {
    switch (device.maintenanceStatus) {
      case "unset":
        return t("statusUnset");
      case "ok":
        return t("statusOk");
      case "due":
        return t("statusDue");
      case "overdue":
        return t("statusOverdue");
      default:
        return device.maintenanceStatus;
    }
  })();

  const onPrint = useCallback(() => {
    printInventoryLabels([label]);
  }, [label]);

  const onRequestService = useCallback(async () => {
    const inv = device.inventoryNumber?.trim();
    if (!inv || requestBusy || device.catalogPending) return;
    setRequestBusy(true);
    try {
      await startServiceRequestFromDevice({ inventoryNumber: inv });
      router.push("/");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("requestServiceFailed"));
    } finally {
      setRequestBusy(false);
    }
  }, [device.catalogPending, device.inventoryNumber, requestBusy, router, t]);

  return (
    <div className="px-4 pb-6 sm:px-[18px]" data-testid="device-detail">
      <section className="p-devhead p-admin__head">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={onBack}>
            {t("backToList")}
          </Button>
          {canEdit && onEdit && (
            <Button type="button" size="sm" className="h-8" onClick={onEdit} data-testid="device-edit-open">
              {t("edit")}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={onPrint}
            data-testid="device-print-label"
          >
            <Printer className="h-4 w-4" />
            {t("printLabel")}
          </Button>
          {canCreateRequest && (
            <Button
              type="button"
              size="sm"
              className="h-8"
              disabled={requestBusy || device.catalogPending || !device.inventoryNumber?.trim()}
              onClick={() => void onRequestService()}
              title={device.catalogPending ? t("catalogPending") : t("requestServiceHint")}
              data-testid="device-request-service"
            >
              <ScanLine className="h-4 w-4" />
              {requestBusy ? t("requestServiceBusy") : t("requestService")}
            </Button>
          )}
          {canShop && (
            <Button type="button" variant="outline" size="sm" className="h-8" asChild>
              <Link
                href={`/shop?device=${encodeURIComponent(device.id)}`}
                title={t("openShopHint")}
                data-testid="device-open-shop"
              >
                {t("openShop")}
              </Link>
            </Button>
          )}
        </div>
        <h2 data-testid="device-detail-title">{device.tradeName ?? device.inventoryNumber}</h2>
        <p className="p-requests__sub">
          {device.inventoryNumber}
          {device.manufacturer ? ` · ${device.manufacturer}` : ""}
          {device.modelName ? ` · ${device.modelName}` : ""}
        </p>
        {device.catalogPending && (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-400" data-testid="device-catalog-pending">
            {t("catalogPending")}
          </p>
        )}
        {detail?.openSendInRepair ? (
          <div className="mt-3" data-testid="device-send-in-chip">
            <Link
              href={`/requests/${encodeURIComponent(detail.openSendInRepair.reference)}`}
              title={t("sendInChipHint")}
              className="inline-flex"
            >
              <Badge variant="secondary">
                {t("sendInChip", { reference: detail.openSendInRepair.reference })}
              </Badge>
            </Link>
          </div>
        ) : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <dl className="rounded-md border border-border bg-card/40 px-4">
          <Row label={t("inventoryNumber")} value={device.inventoryNumber} />
          <Row label={t("serialNumber")} value={device.serialNumber} />
          <Row label={t("tradeName")} value={device.tradeName} />
          <Row label={t("model")} value={device.modelName} />
          <Row label={t("manufacturer")} value={device.manufacturer} />
          <Row label={t("udiDi")} value={detail?.udiDi} />
          <Row label={t("location")} value={device.location?.text} />
          <Row
            label={t("operationalState")}
            value={device.operationalState ?? "in_service"}
          />
          <Row label={t("lockSource")} value={device.lockSource} />
          {device.replacedBy ? (
            <div className="grid gap-1 border-b border-border py-3 sm:grid-cols-[160px_1fr] sm:gap-4">
              <dt className="text-sm text-muted-foreground">{t("linkedLoaner")}</dt>
              <dd className="text-sm text-foreground" data-testid="device-linked-loaner">
                <Link
                  href={`/devices?q=${encodeURIComponent(device.replacedBy.inventoryNumber)}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {device.replacedBy.inventoryNumber}
                </Link>
                {device.replacedBy.loanerLender ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {device.replacedBy.loanerLender}
                  </span>
                ) : null}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({device.replacedBy.operationalState})
                </span>
              </dd>
            </div>
          ) : (
            <Row label={t("loanerLender")} value={device.loanerLender} />
          )}
          {(device.replacementFor?.length ?? 0) > 0 ? (
            <div className="grid gap-1 border-b border-border py-3 sm:grid-cols-[160px_1fr] sm:gap-4">
              <dt className="text-sm text-muted-foreground">{t("loanerFor")}</dt>
              <dd className="text-sm text-foreground" data-testid="device-loaner-for">
                {device.replacementFor!.map((d, i) => (
                  <span key={d.id}>
                    {i > 0 ? ", " : null}
                    <Link
                      href={`/devices?q=${encodeURIComponent(d.inventoryNumber)}`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {d.inventoryNumber}
                    </Link>
                  </span>
                ))}
              </dd>
            </div>
          ) : null}
          <Row label={t("responsible")} value={device.responsiblePerson} />
          <Row label={t("commissioned")} value={formatDate(device.commissionedAt, locale)} />
          <Row
            label={t("maintenanceCycle")}
            value={
              device.maintenanceCycleMonths != null
                ? t("months", { count: device.maintenanceCycleMonths })
                : null
            }
          />
          <Row label={t("lastMaintained")} value={formatDate(device.lastMaintainedAt, locale)} />
          <Row label={t("nextMaintenanceDue")} value={formatDate(device.nextMaintenanceDueAt, locale)} />
          <Row label={t("maintenanceStatus")} value={maintenanceStatusLabel} />
          <Row
            label={t("origin")}
            value={
              device.source === "import"
                ? t("originImport")
                : device.source
                  ? t("originOther", { source: device.source })
                  : null
            }
          />
          {device.source === "import" ? (
            <>
              <Row
                label={t("importFile")}
                value={device.importFileName || null}
              />
              <Row label={t("importHint")} value={device.importHint || null} />
              {device.importJobId ? (
                <div className="grid gap-1 border-b border-border py-3 sm:grid-cols-[160px_1fr] sm:gap-4">
                  <dt className="text-sm text-muted-foreground">{t("importJob")}</dt>
                  <dd className="text-sm text-foreground">
                    <Link
                      href={`/devices/import/jobs?job=${device.importJobId}`}
                      className="text-primary underline-offset-2 hover:underline"
                      data-testid="device-import-job-link"
                    >
                      {t("openImportJob")}
                    </Link>
                  </dd>
                </div>
              ) : null}
            </>
          ) : null}
          {hasProvisionalDuties ? (
            <div
              className="mt-3 space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
              data-testid="device-provisional-duties-banner"
            >
              <p>{t("provisionalDutiesBanner")}</p>
              {provisionalStuckReleased ? (
                <p className="text-xs opacity-90">{t("provisionalDutiesReleasedHint")}</p>
              ) : null}
              {canErstanlage && provisionalNeedsErstanlage ? (
                <Link
                  href={`/registration/${device.id}`}
                  className="inline-flex font-medium text-primary underline-offset-2 hover:underline"
                  data-testid="device-provisional-erstanlage-link"
                >
                  {t("provisionalDutiesCtaErstanlage")}
                </Link>
              ) : null}
            </div>
          ) : null}
          {openImportReviews.length > 0 ? (
            <div
              className="mt-3 space-y-2 rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm text-sky-950 dark:text-sky-100"
              data-testid="device-import-review-banner"
            >
              <p className="font-medium">{t("importReviewBanner")}</p>
              <p className="text-xs opacity-90">{openImportReviews[0]?.label}</p>
              <Link
                href="/devices?tab=klaerliste&issue=import_review"
                className="inline-flex font-medium text-primary underline-offset-2 hover:underline"
                data-testid="device-import-review-link"
              >
                {t("importReviewCta")}
              </Link>
            </div>
          ) : null}
        </dl>

        <aside className="space-y-4">
          <DeviceRoutineCard deviceId={device.id} />
          <div className="rounded-md border border-border bg-card/40 p-4" data-testid="device-detail-label">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {t("labelPreview")}
            </p>
            <div className="mt-3 flex justify-center">
              <InventoryBarcodeLabel label={label} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{t("labelHint")}</p>
          </div>

          {detail?.latestLabels && detail.latestLabels.length > 0 ? (
            <div className="rounded-md border border-border bg-card/40 p-4" data-testid="device-detail-plakette">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {t("testLabelTitle")}
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {detail.latestLabels.map((row) => (
                  <li key={row.dutyKey} data-testid={`device-plakette-${row.dutyKey}`}>
                    <span className="font-medium uppercase">{row.dutyKey}</span>
                    {": "}
                    {row.labelNumber}
                    {row.labelNextDue
                      ? ` · ${t("testLabelNextDue", { date: row.labelNextDue.slice(0, 7) })}`
                      : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-md border border-border bg-card/40 p-4" data-testid="device-detail-classification">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {t("classificationFromModel")}
            </p>
            <div className="mt-3 space-y-2">
              {modelClass?.confidence && (
                <Badge variant="secondary" className="uppercase">
                  {modelClass.confidence}
                </Badge>
              )}
              <p className="text-sm">{classLabels || tCommon("dash")}</p>
              <p className="text-xs text-muted-foreground">
                {modelClass
                  ? t("appliesToCopies", { count: modelClass.instanceCount })
                  : t("noModelClassification")}
              </p>
              {modelHref && (
                <Button asChild type="button" variant="outline" size="sm" className="mt-1 h-8 w-full">
                  <Link href={modelHref} data-testid="device-open-catalog-model">
                    {t("openModelInCatalog")}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </aside>
      </div>

      {detail && detail.course.length > 0 && (
        <div className="rounded-md border border-border bg-card/40 p-4" data-testid="device-course">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {t("course")}
          </p>
          <ul className="mt-3 space-y-3">
            {detail.course.map((event, i) => (
              <li key={`${event.label}-${event.at}-${i}`} className="border-l-2 border-border pl-3">
                <p className="text-sm text-foreground">{event.label}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(event.at, locale)}
                  {event.actor ? ` · ${event.actor}` : ""}
                  {event.actorKind ? ` · ${event.actorKind}` : ""}
                  {event.organisationName ? ` · ${event.organisationName}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {detail && (
        <div id="device-detail-duties">
          <DeviceDutiesPanel
            device={detail}
            canComplete={canEdit}
            completingId={completingDutyId}
            onComplete={onCompleteDuty}
            canUploadReport={Boolean(canEdit) || canCreateRequest}
            onExternalRecorded={onRefresh}
          />
        </div>
      )}

      <div id="device-detail-reports">
        <DeviceReportsCard deviceId={device.id} />
      </div>

      {canEdit ? (
        <UnlockDevicePanel
          deviceId={device.id}
          operationalState={device.operationalState}
          onUnlocked={onRefresh}
        />
      ) : null}
      {canEdit ? (
        <LoanerAssignPanel
          deviceId={device.id}
          operationalState={device.operationalState}
          replacedById={device.replacedById}
          replacedBy={device.replacedBy ?? null}
          onAssigned={onRefresh}
        />
      ) : null}
    </div>
  );
}
