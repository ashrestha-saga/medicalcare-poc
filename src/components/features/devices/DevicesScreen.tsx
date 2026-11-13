"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDevicesList } from "@/components/hooks/devices/useDevicesList";
import { useDeviceEditor } from "@/components/hooks/devices/useDeviceEditor";
import { useSites } from "@/components/hooks/location/useSites";
import { useClarificationsList } from "@/components/hooks/clarifications/useClarificationsList";
import { AccessDenied } from "@/components/features/shared/AccessDenied";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { ClarificationsList } from "@/components/features/clarifications/ClarificationsList";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { useQueryParam, useSyncQueryParams } from "@/lib/navigation/searchParams";
import { cn } from "@/lib/utils";
import { DeviceDetail } from "./DeviceDetail";
import { DeviceEditForm } from "./DeviceEditForm";
import { DevicesTable } from "./devices-table";

function RegistrationButton({ className }: { className?: string }) {
  const t = useTranslations("pages.inventory");
  return (
    <Button type="button" size="sm" className={cn("h-8", className)} asChild data-testid="devices-erstanlage">
      <Link href="/registration">
        <Plus className="h-4 w-4" />
        {t("registration")}
      </Link>
    </Button>
  );
}

type DevicesTab = "all" | "klaerliste";

function parseTab(raw: string | null): DevicesTab {
  if (raw === "klaerliste") return "klaerliste";
  return "all";
}

/** Tenant device inventory list — gated by inventory:view; edit by inventory:update. */
export function DevicesScreen() {
  const t = useTranslations("pages.inventory");
  const tKlar = useTranslations("pages.clarifications");
  const tCommon = useTranslations("common");
  const { checkPermission } = usePermissions();
  const canKlar = checkPermission("clarifications:view");
  const tabParam = useQueryParam("tab");
  const { sync } = useSyncQueryParams();
  const tab = parseTab(tabParam);

  const list = useDevicesList();
  const sites = useSites();
  const klar = useClarificationsList();
  const editor = useDeviceEditor((device) => {
    list.applyUpdated(device);
    void klar.refresh();
  });

  // Legacy Released/Retired tabs → Status filter only.
  useEffect(() => {
    if (tabParam === "released" || tabParam === "retired") {
      sync({ tab: null, state: tabParam });
    }
  }, [tabParam, sync]);

  const setTab = (next: DevicesTab) => {
    sync({
      tab: next === "all" ? null : next,
    });
  };

  if (!list.canView) {
    return (
      <AccessDenied
        title={t("title")}
        description={t("denied")}
        hint={tCommon("contactAdmin")}
        testId="devices-denied"
      />
    );
  }

  const openCases = klar.summary.openCases;
  const showKlar = tab === "klaerliste" && canKlar;

  const tabs: { id: DevicesTab; label: string; show?: boolean }[] = [
    { id: "all", label: t("tabAll") },
    { id: "klaerliste", label: t("tabKlarliste"), show: canKlar },
  ];

  return (
    <div className="p-work" data-testid="devices-page">
      <main className="p-main">
        {editor.open ? (
          <DeviceEditForm form={editor} sites={sites} />
        ) : list.selected && !showKlar ? (
          <DeviceDetail
            device={list.selected}
            canEdit={list.canUpdate && !list.selected.catalogPending}
            onBack={list.clearSelection}
            onEdit={() => void editor.openEdit(list.selected!)}
            completingDutyId={list.completingDutyId}
            onCompleteDuty={(id, input) => void list.completeDuty(id, input)}
          />
        ) : (
          <ListPageShell
            title={t("title")}
            description={showKlar ? tKlar("description") : t("description")}
            headerExtra={
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div
                  className="flex flex-wrap gap-1"
                  role="tablist"
                  aria-label={t("title")}
                  data-testid="devices-tabs"
                >
                  {tabs
                    .filter((x) => x.show !== false)
                    .map((x) => {
                      const isOpenIssues = x.id === "klaerliste";
                      const hasIssues = isOpenIssues && openCases > 0;
                      const selected = tab === x.id;
                      return (
                        <button
                          key={x.id}
                          type="button"
                          role="tab"
                          aria-selected={selected}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                            selected && !hasIssues && "bg-primary text-primary-foreground",
                            selected &&
                              hasIssues &&
                              "bg-amber-600 text-white hover:bg-amber-600/90",
                            !selected &&
                              !hasIssues &&
                              "bg-muted text-muted-foreground hover:bg-muted/80",
                            !selected &&
                              hasIssues &&
                              "bg-amber-500/15 text-amber-800 ring-1 ring-inset ring-amber-500/40 hover:bg-amber-500/25 dark:text-amber-200",
                          )}
                          data-testid={`devices-tab-${x.id}`}
                          onClick={() => setTab(x.id)}
                        >
                          {x.label}
                          {hasIssues ? (
                            <span
                              className={cn(
                                "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                                selected ? "bg-white/20 text-white" : "bg-amber-600 text-white",
                              )}
                              data-testid="devices-open-issues-badge"
                            >
                              {openCases}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                </div>
                {showKlar && list.canUpdate ? <RegistrationButton /> : null}
              </div>
            }
          >
            {showKlar ? (
              !klar.canView ? (
                <AccessDenied
                  title={tKlar("title")}
                  description={tCommon("denied")}
                  hint={tCommon("contactAdmin")}
                  testId="devices-klar-denied"
                />
              ) : (
                <ClarificationsList
                  summary={klar.summary}
                  items={klar.items}
                  loading={klar.loading}
                  canEdit={klar.canUpdate}
                  issue={klar.issue}
                  severity={klar.severity}
                  onIssueChange={klar.setIssue}
                  onSeverityChange={klar.setSeverity}
                  onClearFilters={klar.clearFilters}
                  onEdit={(item) =>
                    void editor.openEdit({
                      id: item.deviceId,
                      inventoryNumber: item.inventoryNumber,
                      serialNumber: item.serialNumber,
                      manufacturer: null,
                      modelName: null,
                      tradeName: item.title,
                      modelId: item.modelId,
                      state: "draft",
                      modelState: null,
                      location: item.locationText
                        ? {
                            siteId: null,
                            siteName: null,
                            areaId: null,
                            areaName: null,
                            room: null,
                            text: item.locationText,
                          }
                        : null,
                      commissionedAt: null,
                      responsiblePerson: null,
                      responsibleUserId: null,
                      maintenanceCycleMonths: null,
                      maintenanceAnchorAt: null,
                      lastMaintainedAt: null,
                      nextMaintenanceDueAt: null,
                      maintenanceStatus: "unset",
                      classification: null,
                      inspectionTags: [],
                      isReprocessingEquipment: false,
                      catalogPending: false,
                      retiredAt: null,
                      decommissionedAt: null,
                      retainUntil: null,
                      retentionStatus: "none",
                    })
                  }
                />
              )
            ) : (
              <>
                {canKlar && openCases > 0 ? (
                  <div
                    className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
                    data-testid="devices-open-issues-banner"
                  >
                    <span>{t("openIssuesBanner", { count: openCases })}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 border-amber-600/40 bg-background/60"
                      onClick={() => setTab("klaerliste")}
                    >
                      {t("tabKlarliste")}
                    </Button>
                  </div>
                ) : null}
                <DevicesTable
                  list={list}
                  onSelect={(device) => void list.selectDevice(device)}
                  onEdit={(device) => void editor.openEdit(device)}
                />
              </>
            )}
          </ListPageShell>
        )}
      </main>
    </div>
  );
}
