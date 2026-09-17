"use client";

import { Loader2 } from "lucide-react";
import type { DeviceInstanceDetailDTO } from "@/interfaces";
import {
  deviceDisplayName,
  deviceInspectionTags,
} from "@/components/hooks/scan/useCapturerInventory";

interface CapturerDeviceRecordProps {
  device: DeviceInstanceDetailDTO | null;
  loading?: boolean;
  onClose: () => void;
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="p-bestand-detail__row">
      <dt>{label}</dt>
      <dd>{value?.trim() ? value : "—"}</dd>
    </div>
  );
}

function formatYear(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return String(new Date(iso).getUTCFullYear());
  } catch {
    return "—";
  }
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function sourceLabel(source: DeviceInstanceDetailDTO["modelSource"]): string {
  if (source === "beudamed") return "BEUDAMED";
  if (source === "catalog") return "Katalog";
  if (source === "manual") return "Handerfassung";
  return "—";
}

export function CapturerDeviceRecord({ device, loading, onClose }: CapturerDeviceRecordProps) {
  if (loading || !device) {
    return (
      <div className="p-bestand-detail" data-testid="capturer-device-loading">
        <div className="p-bestand-detail__wait">
          <Loader2 className="h-4 w-4 animate-spin" />
          Gerätedatensatz wird geladen…
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
    "—";

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
          aria-label="Schließen"
          data-testid="capturer-device-close"
        >
          ×
        </button>
      </header>

      <p className="p-bestand-detail__section">Gerätedatensatz</p>

      <dl className="p-bestand-detail__fields">
        <Field label="Inventarnummer" value={device.inventoryNumber} />
        <Field label="Art und Typ" value={device.modelName ?? device.tradeName} />
        <Field label="Seriennummer" value={device.serialNumber} />
        <Field label="UDI-DI" value={device.udiDi} />
        <Field label="Anschaffungsjahr" value={formatYear(device.commissionedAt)} />
        <Field label="Hersteller" value={device.manufacturer} />
        <Field label="Standort" value={location} />
        <div className="p-bestand-detail__row">
          <dt>Einstufung</dt>
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
              "—"
            )}
          </dd>
        </div>
      </dl>

      <div className="p-bestand-detail__meta">
        {device.modelClassification?.source && (
          <p className="p-bestand-detail__meta-title">{device.modelClassification.source}</p>
        )}
        <p>
          Angelegt · {formatWhen(device.createdAt)}
          {device.responsiblePerson ? ` · ${device.responsiblePerson}` : ""}
        </p>
        <p>Quelle · {sourceLabel(device.modelSource)}</p>
      </div>

      <button
        type="button"
        className="p-bestand-detail__back"
        onClick={onClose}
        data-testid="capturer-device-back"
      >
        Zurück
      </button>
    </div>
  );
}
