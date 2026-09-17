"use client";

import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import type { SiteDTO } from "@/interfaces";
import type { useDeviceEditor } from "@/components/hooks/devices/useDeviceEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/lib/providers/PermissionProvider";

type EditorApi = ReturnType<typeof useDeviceEditor>;

interface DeviceEditFormProps {
  form: EditorApi;
  sites: SiteDTO[];
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function classificationSummary(form: EditorApi): string {
  const c = form.detail?.modelClassification;
  if (!c) return "No model classification on file.";
  const parts = [
    c.softwareClass,
    c.annex1 ? "Annex 1" : null,
    c.annex2 ? "Annex 2" : null,
    c.radiation ? "Radiation" : null,
    c.confidence,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Documented on model";
}

export function DeviceEditForm({ form, sites }: DeviceEditFormProps) {
  const { checkPermission } = usePermissions();
  const canViewCatalog = checkPermission("catalog:view");
  const modelHref =
    form.detail?.modelId && canViewCatalog ? `/catalog/${form.detail.modelId}` : null;

  const areaOptions = sites.flatMap((site) =>
    site.areas.map((area) => ({
      id: area.id,
      label: `${site.name} · ${area.name}`,
    })),
  );

  const title = form.detail?.tradeName ?? form.detail?.modelName ?? form.detail?.inventoryNumber ?? "Device";
  const meta = [
    form.detail?.inventoryNumber,
    form.detail?.modelState,
    form.detail?.modelSource,
    form.detail?.commissionedAt
      ? new Date(form.detail.commissionedAt).toLocaleDateString("de-DE")
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="px-4 pb-8 sm:px-[18px]" data-testid="device-edit">
      <section className="p-devhead p-admin__head">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-2 h-8 px-0 text-muted-foreground"
          onClick={form.close}
          data-testid="device-edit-back"
        >
          ← To the inventory list
        </Button>
        <h2 data-testid="device-edit-title">{title}</h2>
        <p className="p-requests__sub">{meta || "Edit device record"}</p>
      </section>

      {form.loading || !form.detail ? (
        <div className="flex items-center gap-2 px-1 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading device…
        </div>
      ) : (
        <form
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]"
          onSubmit={(e) => {
            e.preventDefault();
            void form.submit();
          }}
        >
          <div className="space-y-4 rounded-xl border border-border bg-card/40 p-4 sm:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Mandatory information
            </p>

            <div className="grid gap-2">
              <Label htmlFor="device-designation" required>
                Designation
              </Label>
              <Input
                id="device-designation"
                value={form.tradeName}
                onChange={(e) => form.setTradeName(e.target.value)}
                disabled={form.busy || !form.detail.modelId}
                data-testid="device-trade-name"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="device-type" required>
                  Type / model
                </Label>
                <Input
                  id="device-type"
                  value={form.modelName}
                  onChange={(e) => form.setModelName(e.target.value)}
                  disabled={form.busy || !form.detail.modelId}
                  data-testid="device-model-name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="device-manufacturer" required>
                  Manufacturer
                </Label>
                <Input
                  id="device-manufacturer"
                  value={form.manufacturer}
                  onChange={(e) => form.setManufacturer(e.target.value)}
                  disabled={form.busy || !form.detail.modelId}
                  data-testid="device-manufacturer"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="device-serial">Serial number</Label>
                <Input
                  id="device-serial"
                  value={form.serialNumber}
                  onChange={(e) => form.setSerialNumber(e.target.value)}
                  disabled={form.busy}
                  data-testid="device-serial"
                />
                {form.fieldErrors.serialNumber && (
                  <p className="text-xs text-destructive">{form.fieldErrors.serialNumber}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="device-udi">UDI-DI</Label>
                <Input
                  id="device-udi"
                  value={form.udiDi}
                  onChange={(e) => form.setUdiDi(e.target.value)}
                  disabled={form.busy || !form.detail.modelId}
                  data-testid="device-udi"
                />
                {form.fieldErrors.udiDi && (
                  <p className="text-xs text-destructive">{form.fieldErrors.udiDi}</p>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              One of the two identifiers is sufficient, but not neither.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="device-year" required>
                  Year of purchase
                </Label>
                <Input
                  id="device-year"
                  inputMode="numeric"
                  value={form.purchaseYear}
                  onChange={(e) => form.setPurchaseYear(e.target.value)}
                  disabled={form.busy}
                  data-testid="device-year"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="device-responsible" required>
                  Responsible person
                </Label>
                <Input
                  id="device-responsible"
                  value={form.responsiblePerson}
                  onChange={(e) => form.setResponsiblePerson(e.target.value)}
                  disabled={form.busy}
                  data-testid="device-responsible"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label required>Location / area</Label>
                <Select
                  value={form.areaId || undefined}
                  onValueChange={form.setAreaId}
                  disabled={form.busy}
                >
                  <SelectTrigger data-testid="device-area">
                    <SelectValue placeholder="Select area" />
                  </SelectTrigger>
                  <SelectContent>
                    {areaOptions.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="device-inv" required>
                  Inventory number
                </Label>
                <Input
                  id="device-inv"
                  value={form.inventoryNumber}
                  onChange={(e) => form.setInventoryNumber(e.target.value)}
                  disabled={form.busy}
                  data-testid="device-inventory-number"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="device-room">Space / room</Label>
              <Input
                id="device-room"
                value={form.room}
                onChange={(e) => form.setRoom(e.target.value)}
                disabled={form.busy}
                data-testid="device-room"
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" disabled={form.busy} data-testid="device-save">
                {form.busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </Button>
              <Button type="button" variant="outline" disabled={form.busy} onClick={form.close}>
                Cancel
              </Button>
            </div>
          </div>

          <aside className="space-y-4">
            <div
              className="rounded-xl border border-border bg-card/40 p-4"
              data-testid="device-model-classification"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Classification — from the model
              </p>
              <div className="mt-3 space-y-2">
                {form.detail.modelClassification?.confidence && (
                  <Badge variant="secondary" className="uppercase">
                    {form.detail.modelClassification.confidence}
                  </Badge>
                )}
                <p className="text-sm text-foreground">{classificationSummary(form)}</p>
                <p className="text-xs text-muted-foreground">
                  {form.detail.modelClassification
                    ? `Applies to all ${form.detail.modelClassification.instanceCount} copies of this model.`
                    : "Link a device model to inherit classification."}
                </p>
                <p className="text-xs text-muted-foreground">
                  Not editable here — classification always comes from the model.
                </p>
                {modelHref && (
                  <Button asChild type="button" variant="outline" size="sm" className="mt-1 h-8 w-full">
                    <Link href={modelHref} data-testid="device-edit-open-catalog-model">
                      Open model in catalog
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card/40 p-4" data-testid="device-course">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Course
              </p>
              <ul className="mt-3 space-y-3">
                {form.detail.course.map((event) => (
                  <li key={`${event.label}-${event.at}`} className="border-l-2 border-border pl-3">
                    <p className="text-sm text-foreground">{event.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatWhen(event.at)}
                      {event.actor ? ` · ${event.actor}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </form>
      )}
    </div>
  );
}
