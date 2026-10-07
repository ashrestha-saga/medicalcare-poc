"use client";

import { useCallback } from "react";
import Link from "next/link";
import { ExternalLink, Printer } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { DeviceInstanceDetailDTO, DeviceInstanceDTO } from "@/interfaces";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InventoryBarcodeLabel } from "@/components/features/devices/labels/InventoryBarcodeLabel";
import { printInventoryLabels } from "@/components/features/devices/labels/printInventoryLabels";
import { formatDate } from "@/lib/format";
import { toInventoryLabel } from "@/lib/inventory/label";
import type { AppLocale } from "@/lib/locale";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { DeviceDutiesPanel } from "./DeviceDutiesPanel";

interface DeviceDetailProps {
  device: DeviceInstanceDTO | DeviceInstanceDetailDTO;
  canEdit?: boolean;
  onBack: () => void;
  onEdit?: () => void;
  completingDutyId?: string | null;
  onCompleteDuty?: (dutyId: string) => void;
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
  completingDutyId,
  onCompleteDuty,
}: DeviceDetailProps) {
  const t = useTranslations("inventoryDetail");
  const tCommon = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const { checkPermission } = usePermissions();
  const canViewCatalog = checkPermission("catalog:view");
  const detail = isDetail(device) ? device : null;
  const modelClass = detail?.modelClassification;
  const modelHref = device.modelId && canViewCatalog ? `/catalog/${device.modelId}` : null;
  const label = toInventoryLabel(device);

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
        </dl>

        <aside className="space-y-4">
          <div className="rounded-md border border-border bg-card/40 p-4" data-testid="device-detail-label">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {t("labelPreview")}
            </p>
            <div className="mt-3 flex justify-center">
              <InventoryBarcodeLabel label={label} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{t("labelHint")}</p>
          </div>

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
        <DeviceDutiesPanel
          device={detail}
          canComplete={canEdit}
          completingId={completingDutyId}
          onComplete={onCompleteDuty}
        />
      )}
    </div>
  );
}
