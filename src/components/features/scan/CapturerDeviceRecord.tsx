"use client";

import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { DeviceInstanceDetailDTO } from "@/interfaces";
import {
  deviceDisplayName,
  deviceInspectionTags,
} from "@/components/hooks/scan/useCapturerInventory";
import { formatDate } from "@/lib/format";
import type { AppLocale } from "@/lib/locale";

interface CapturerDeviceRecordProps {
  device: DeviceInstanceDetailDTO | null;
  loading?: boolean;
  onClose: () => void;
}

function Field({ label, value, dash }: { label: string; value: string | null | undefined; dash: string }) {
  return (
    <div className="p-bestand-detail__row">
      <dt>{label}</dt>
      <dd>{value?.trim() ? value : dash}</dd>
    </div>
  );
}

function formatYear(iso: string | null | undefined, dash: string): string {
  if (!iso) return dash;
  try {
    return String(new Date(iso).getUTCFullYear());
  } catch {
    return dash;
  }
}

function sourceLabel(
  source: DeviceInstanceDetailDTO["modelSource"],
  labels: { catalog: string; manual: string },
  dash: string,
): string {
  if (source === "beudamed") return "BEUDAMED";
  if (source === "catalog") return labels.catalog;
  if (source === "manual") return labels.manual;
  return dash;
}

export function CapturerDeviceRecord({ device, loading, onClose }: CapturerDeviceRecordProps) {
  const t = useTranslations("capturer");
  const tCommon = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const dash = tCommon("dash");

  if (loading || !device) {
    return (
      <div className="p-bestand-detail" data-testid="capturer-device-loading">
        <div className="p-bestand-detail__wait">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("deviceLoading")}
        </div>
      </div>
    );
  }

  const tags = deviceInspectionTags(device);
  const location =
    device.location?.text ||
    [device.location?.siteName, device.location?.areaName, device.location?.room]
      .filter(Boolean)
      .join(" · ") ||
    dash;

  return (
    <div className="p-bestand-detail" data-testid="capturer-device-record">
      <header className="p-bestand-detail__head">
        <div>
          <h2>{deviceDisplayName(device)}</h2>
          <p className="p-bestand-detail__sub">
            {device.inventoryNumber}
            {device.manufacturer ? ` · ${device.manufacturer}` : ""}
          </p>
        </div>
        <button
          type="button"
          className="p-bestand-detail__close"
          onClick={onClose}
          aria-label={tCommon("close")}
          data-testid="capturer-device-close"
        >
          ×
        </button>
      </header>

      <p className="p-bestand-detail__section">{t("deviceSection")}</p>

      <dl className="p-bestand-detail__fields">
        <Field label={t("inventoryNumber")} value={device.inventoryNumber} dash={dash} />
        <Field label={t("typeModel")} value={device.modelName ?? device.tradeName} dash={dash} />
        <Field label={t("serialNumber")} value={device.serialNumber} dash={dash} />
        <Field label={t("udiDi")} value={device.udiDi} dash={dash} />
        <Field label={t("yearAcquired")} value={formatYear(device.commissionedAt, dash)} dash={dash} />
        <Field label={t("manufacturer")} value={device.manufacturer} dash={dash} />
        <Field label={t("location")} value={location} dash={dash} />
        <div className="p-bestand-detail__row">
          <dt>{t("classification")}</dt>
          <dd>
            {tags.length ? (
              <div className="p-bestand__tags">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="p-bestand__tag"
                    data-tag={tag.toLowerCase().replace(/\s+/g, "-")}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              dash
            )}
          </dd>
        </div>
      </dl>

      <div className="p-bestand-detail__meta">
        {device.modelClassification?.source && (
          <p className="p-bestand-detail__meta-title">{device.modelClassification.source}</p>
        )}
        <p>
          {t("created", { when: formatDate(device.createdAt, locale) })}
          {device.responsiblePerson ? ` · ${device.responsiblePerson}` : ""}
        </p>
        <p>{t("source", { source: sourceLabel(device.modelSource, { catalog: t("sourceCatalog"), manual: t("sourceManual") }, dash) })}</p>
      </div>

      <button
        type="button"
        className="p-bestand-detail__back"
        onClick={onClose}
        data-testid="capturer-device-back"
      >
        {tCommon("back")}
      </button>
    </div>
  );
}
