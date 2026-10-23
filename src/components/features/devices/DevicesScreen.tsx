"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useDevicesList } from "@/components/hooks/devices/useDevicesList";
import { useDeviceEditor } from "@/components/hooks/devices/useDeviceEditor";
import { useSites } from "@/components/hooks/location/useSites";
import { useClarificationsList } from "@/components/hooks/clarifications/useClarificationsList";
import { AccessDenied } from "@/components/features/shared/AccessDenied";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { ClarificationsList } from "@/components/features/clarifications/ClarificationsList";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { useQueryParam, useSyncQueryParams } from "@/lib/navigation/searchParams";
import { cn } from "@/lib/utils";
import { DeviceDetail } from "./DeviceDetail";
import { DeviceEditForm } from "./DeviceEditForm";
import { DevicesTable } from "./devices-table";

type DevicesTab = "all" | "klaerliste" | "released" | "retired";

function parseTab(raw: string | null): DevicesTab {
  if (raw === "klaerliste" || raw === "released" || raw === "retired" || raw === "all") return raw;
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

  useEffect(() => {
    if (tab === "released" && list.stateFilter !== "released") {
      list.setStateFilter("released");
    } else if (tab === "retired" && list.stateFilter !== "retired") {
      list.setStateFilter("retired");
    } else if (tab === "all" && list.stateFilter != null && tabParam === "all") {
      list.setStateFilter(null);
    }
    // Intentionally sync tab → state filter once per tab change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- list setters are stable enough; avoid loop
  }, [tab, tabParam]);

  const setTab = (next: DevicesTab) => {
    sync({
      tab: next === "all" ? null : next,
      state: next === "released" ? "released" : next === "retired" ? "retired" : null,
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

  const tabs: { id: DevicesTab; label: string; show?: boolean }[] = [
    { id: "all", label: t("tabAll") },
    { id: "klaerliste", label: t("tabKlarliste"), show: canKlar },
    { id: "released", label: t("tabReleased") },
    { id: "retired", label: t("tabRetired") },
  ];

  const showKlar = tab === "klaerliste" && canKlar;

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
            onCompleteDuty={(id) => void list.completeDuty(id)}
          />
        ) : (
          <ListPageShell
            title={t("title")}
            description={showKlar ? tKlar("description") : t("description")}
            headerExtra={
              <div className="flex flex-wrap gap-1" role="tablist" aria-label={t("title")} data-testid="devices-tabs">
                {tabs
                  .filter((x) => x.show !== false)
                  .map((x) => (
                    <button
                      key={x.id}
                      type="button"
                      role="tab"
                      aria-selected={tab === x.id}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        tab === x.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80",
                      )}
                      data-testid={`devices-tab-${x.id}`}
                      onClick={() => setTab(x.id)}
                    >
                      {x.label}
                    </button>
                  ))}
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
              <DevicesTable
                list={list}
                onSelect={(device) => void list.selectDevice(device)}
                onEdit={(device) => void editor.openEdit(device)}
              />
            )}
          </ListPageShell>
        )}
      </main>
    </div>
  );
}
