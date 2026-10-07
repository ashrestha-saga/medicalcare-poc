"use client";

import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { SiteDTO } from "@/interfaces";
import type { useDeviceEditor } from "@/components/hooks/devices/useDeviceEditor";
import { UserSelect } from "@/components/features/shared/UserSelect";
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
import { formatDate, formatDateTime } from "@/lib/format";
import type { AppLocale } from "@/lib/locale";
import { usePermissions } from "@/lib/providers/PermissionProvider";

type EditorApi = ReturnType<typeof useDeviceEditor>;
type IssuesT = ReturnType<typeof useTranslations<"clarificationsIssues">>;

interface DeviceEditFormProps {
  form: EditorApi;
  sites: SiteDTO[];
}

function stateLabel(state: string, t: IssuesT): string {
  switch (state) {
    case "draft":
      return t("stateDraft");
    case "review":
      return t("stateReview");
    case "released":
      return t("stateReleased");
    case "retired":
      return t("stateRetired");
    default:
      return state;
  }
}

function classificationSummary(form: EditorApi, t: IssuesT): string {
  const c = form.detail?.modelClassification;
  if (!c) return t("noModelClassification");
  const parts = [
    c.softwareClass ? t("classSw", { class: c.softwareClass }) : null,
    c.annex1 ? t("classAnnex1") : null,
    c.annex2 ? t("classAnnex2") : null,
    c.radiation ? t("classRadiation") : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

export function DeviceEditForm({ form, sites }: DeviceEditFormProps) {
  const t = useTranslations("clarificationsIssues");
  const locale = useLocale() as AppLocale;
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

  const title =
    form.detail?.tradeName ??
    form.detail?.modelName ??
    form.detail?.inventoryNumber ??
    t("deviceFallback");
  const identityLocked = form.state === "released" || form.state === "retired";
  const meta = [
    form.detail?.inventoryNumber,
    form.state ? stateLabel(form.state, t) : null,
    form.detail?.modelSource,
    form.detail?.commissionedAt ? formatDate(form.detail.commissionedAt, locale) : null,
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
          {t("backToInventory")}
        </Button>
        <h2 data-testid="device-edit-title">{title}</h2>
        <p className="p-requests__sub">{meta || t("editDeviceRecord")}</p>
        {identityLocked && (
          <p className="mt-2 text-sm text-muted-foreground" data-testid="device-identity-locked">
            {t("identityLocked")}
          </p>
        )}
      </section>

      {form.loading || !form.detail ? (
        <div className="flex items-center gap-2 px-1 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("loadingDevice")}
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
              {t("mandatoryInformation")}
            </p>

            <div className="grid gap-2">
              <Label htmlFor="device-designation" required>
                {t("designation")}
              </Label>
              <Input
                id="device-designation"
                value={form.tradeName}
                onChange={(e) => form.setTradeName(e.target.value)}
                disabled={form.busy || identityLocked || !form.detail.modelId}
                data-testid="device-trade-name"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="device-type" required>
                  {t("typeModel")}
                </Label>
                <Input
                  id="device-type"
                  value={form.modelName}
                  onChange={(e) => form.setModelName(e.target.value)}
                  disabled={form.busy || identityLocked || !form.detail.modelId}
                  data-testid="device-model-name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="device-manufacturer" required>
                  {t("manufacturer")}
                </Label>
                <Input
                  id="device-manufacturer"
                  value={form.manufacturer}
                  onChange={(e) => form.setManufacturer(e.target.value)}
                  disabled={form.busy || identityLocked || !form.detail.modelId}
                  data-testid="device-manufacturer"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="device-serial">{t("serialNumber")}</Label>
                <Input
                  id="device-serial"
                  value={form.serialNumber}
                  onChange={(e) => form.setSerialNumber(e.target.value)}
                  disabled={form.busy || identityLocked}
                  data-testid="device-serial"
                />
                {form.fieldErrors.serialNumber && (
                  <p className="text-xs text-destructive">{form.fieldErrors.serialNumber}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="device-udi">{t("udiDi")}</Label>
                <Input
                  id="device-udi"
                  value={form.udiDi}
                  onChange={(e) => form.setUdiDi(e.target.value)}
                  disabled={form.busy || identityLocked || !form.detail.modelId}
                  data-testid="device-udi"
                />
                {form.fieldErrors.udiDi && (
                  <p className="text-xs text-destructive">{form.fieldErrors.udiDi}</p>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t("identifierHint")}</p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="device-year" required>
                  {t("yearOfPurchase")}
                </Label>
                <Input
                  id="device-year"
                  inputMode="numeric"
                  value={form.purchaseYear}
                  onChange={(e) => form.setPurchaseYear(e.target.value)}
                  disabled={form.busy || identityLocked}
                  data-testid="device-year"
                />
              </div>
              <UserSelect
                id="device-responsible"
                value={form.responsibleUserId}
                onChange={form.setResponsibleUserId}
                roles={["device_admin"]}
                label={t("responsiblePerson")}
                placeholder={t("selectDeviceAdmin")}
                disabled={form.busy}
                data-testid="device-responsible"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label required>{t("locationArea")}</Label>
                <Select
                  value={form.areaId || undefined}
                  onValueChange={form.setAreaId}
                  disabled={form.busy}
                >
                  <SelectTrigger data-testid="device-area">
                    <SelectValue placeholder={t("selectArea")} />
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
                  {t("inventoryNumber")}
                </Label>
                <Input
                  id="device-inv"
                  value={form.inventoryNumber}
                  onChange={(e) => form.setInventoryNumber(e.target.value)}
                  disabled={form.busy || identityLocked}
                  data-testid="device-inventory-number"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="device-room">{t("spaceRoom")}</Label>
              <Input
                id="device-room"
                value={form.room}
                onChange={(e) => form.setRoom(e.target.value)}
                disabled={form.busy}
                data-testid="device-room"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>{t("state")}</Label>
                <Select
                  value={form.state}
                  onValueChange={(v) => form.setState(v as typeof form.state)}
                  disabled={form.busy}
                >
                  <SelectTrigger data-testid="device-state">
                    <SelectValue placeholder={t("selectState")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">{t("stateDraft")}</SelectItem>
                    <SelectItem value="review">{t("stateReview")}</SelectItem>
                    <SelectItem value="released">{t("stateReleased")}</SelectItem>
                    <SelectItem value="retired">{t("stateRetired")}</SelectItem>
                  </SelectContent>
                </Select>
                {form.state !== "released" && form.state !== "retired" ? (
                  <p className="text-xs text-muted-foreground">{t("notYetReleasedHint")}</p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="device-cycle">{t("maintenanceCycleMonths")}</Label>
                <Input
                  id="device-cycle"
                  type="number"
                  min={1}
                  max={120}
                  value={form.maintenanceCycleMonths}
                  onChange={(e) => form.setMaintenanceCycleMonths(e.target.value)}
                  disabled={form.busy}
                  placeholder={t("cyclePlaceholder")}
                  data-testid="device-maintenance-cycle"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>{t("nextDue")}</Label>
              <Input
                value={
                  form.detail.nextMaintenanceDueAt
                    ? formatDate(form.detail.nextMaintenanceDueAt, locale)
                    : "—"
                }
                readOnly
                disabled
                data-testid="device-next-due"
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" disabled={form.busy} data-testid="device-save">
                {form.busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("save")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={
                  form.busy || form.completingMaintenance || !form.maintenanceCycleMonths.trim()
                }
                onClick={() => void form.markMaintenanceDone()}
                data-testid="device-mark-maintenance-done"
              >
                {form.completingMaintenance && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("markMaintenanceDone")}
              </Button>
              <Button type="button" variant="outline" disabled={form.busy} onClick={form.close}>
                {t("cancel")}
              </Button>
            </div>
          </div>

          <aside className="space-y-4">
            <div
              className="rounded-xl border border-border bg-card/40 p-4"
              data-testid="device-model-classification"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {t("classificationFromModel")}
              </p>
              <div className="mt-3 space-y-2">
                {form.detail.modelClassification?.confidence && (
                  <Badge variant="secondary" className="uppercase">
                    {form.detail.modelClassification.confidence}
                  </Badge>
                )}
                <p className="text-sm text-foreground">{classificationSummary(form, t)}</p>
                <p className="text-xs text-muted-foreground">
                  {form.detail.modelClassification
                    ? t("appliesToCopies", {
                        count: form.detail.modelClassification.instanceCount,
                      })
                    : t("linkModelForClassification")}
                </p>
                <p className="text-xs text-muted-foreground">{t("notEditableHere")}</p>
                {modelHref && (
                  <Button asChild type="button" variant="outline" size="sm" className="mt-1 h-8 w-full">
                    <Link href={modelHref} data-testid="device-edit-open-catalog-model">
                      {t("openModelInCatalog")}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card/40 p-4" data-testid="device-course">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {t("course")}
              </p>
              <ul className="mt-3 space-y-3">
                {form.detail.course.map((event) => (
                  <li key={`${event.label}-${event.at}`} className="border-l-2 border-border pl-3">
                    <p className="text-sm text-foreground">{event.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(event.at, locale)}
                      {event.actor ? ` · ${event.actor}` : ""}
                      {event.actorKind ? ` · ${event.actorKind}` : ""}
                      {event.organisationName ? ` · ${event.organisationName}` : ""}
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
