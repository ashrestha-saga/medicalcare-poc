"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { DeviceInstanceDetailDTO, DeviceInstanceDTO } from "@/interfaces";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/lib/providers/PermissionProvider";

interface DeviceDetailProps {
  device: DeviceInstanceDTO | DeviceInstanceDetailDTO;
  canEdit?: boolean;
  onBack: () => void;
  onEdit?: () => void;
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid gap-1 border-b border-border py-3 sm:grid-cols-[160px_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value?.trim() ? value : "—"}</dd>
    </div>
  );
}

function formatDate(iso: string | null | undefined): string {
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

function isDetail(device: DeviceInstanceDTO | DeviceInstanceDetailDTO): device is DeviceInstanceDetailDTO {
  return "modelClassification" in device;
}

export function DeviceDetail({ device, canEdit, onBack, onEdit }: DeviceDetailProps) {
  const { checkPermission } = usePermissions();
  const canViewCatalog = checkPermission("catalog:view");
  const detail = isDetail(device) ? device : null;
  const modelClass = detail?.modelClassification;
  const modelHref = device.modelId && canViewCatalog ? `/catalog/${device.modelId}` : null;

  return (
    <div className="px-4 pb-6 sm:px-[18px]" data-testid="device-detail">
      <section className="p-devhead p-admin__head">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={onBack}>
            ← Inventory list
          </Button>
          {canEdit && onEdit && (
            <Button type="button" size="sm" className="h-8" onClick={onEdit} data-testid="device-edit-open">
              Edit
            </Button>
          )}
        </div>
        <h2 data-testid="device-detail-title">{device.tradeName ?? device.inventoryNumber}</h2>
        <p className="p-requests__sub">
          {device.inventoryNumber}
          {device.manufacturer ? ` · ${device.manufacturer}` : ""}
          {device.modelName ? ` · ${device.modelName}` : ""}
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <dl className="rounded-md border border-border bg-card/40 px-4">
          <Row label="Inventory number" value={device.inventoryNumber} />
          <Row label="Serial number" value={device.serialNumber} />
          <Row label="Trade name" value={device.tradeName} />
          <Row label="Model" value={device.modelName} />
          <Row label="Manufacturer" value={device.manufacturer} />
          <Row label="UDI-DI" value={detail?.udiDi} />
          <Row label="Location" value={device.location?.text} />
          <Row label="Responsible" value={device.responsiblePerson} />
          <Row label="Commissioned" value={formatDate(device.commissionedAt)} />
        </dl>

        <aside className="space-y-4">
          <div className="rounded-md border border-border bg-card/40 p-4" data-testid="device-detail-classification">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Classification — from the model
            </p>
            <div className="mt-3 space-y-2">
              {modelClass?.confidence && (
                <Badge variant="secondary" className="uppercase">
                  {modelClass.confidence}
                </Badge>
              )}
              <p className="text-sm">
                {[
                  modelClass?.softwareClass,
                  modelClass?.annex1 ? "Annex 1" : null,
                  modelClass?.annex2 ? "Annex 2" : null,
                  modelClass?.radiation ? "Radiation" : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {modelClass
                  ? `Applies to all ${modelClass.instanceCount} copies of this model.`
                  : "No model classification available."}
              </p>
              {modelHref && (
                <Button asChild type="button" variant="outline" size="sm" className="mt-1 h-8 w-full">
                  <Link href={modelHref} data-testid="device-open-catalog-model">
                    Open model in catalog
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
