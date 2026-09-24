"use client";

import { useTranslations } from "next-intl";
import { useDevicesList } from "@/components/hooks/devices/useDevicesList";
import { useDeviceEditor } from "@/components/hooks/devices/useDeviceEditor";
import { useSites } from "@/components/hooks/location/useSites";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { DeviceDetail } from "./DeviceDetail";
import { DeviceEditForm } from "./DeviceEditForm";
import { DevicesTable } from "./devices-table";

/** Tenant device inventory list — gated by inventory:view; edit by inventory:update. */
export function DevicesScreen() {
  const t = useTranslations("pages.inventory");
  const tCommon = useTranslations("common");
  const list = useDevicesList();
  const sites = useSites();
  const editor = useDeviceEditor((device) => {
    list.applyUpdated(device);
  });

  if (!list.canView) {
    return (
      <div className="p-work" data-testid="devices-denied">
        <main className="p-main">
          <ListPageShell title={t("title")} description={t("denied")}>
            <p className="text-sm text-muted-foreground">{tCommon("contactAdmin")}</p>
          </ListPageShell>
        </main>
      </div>
    );
  }

  return (
    <div className="p-work" data-testid="devices-page">
      <main className="p-main">
        {editor.open ? (
          <DeviceEditForm form={editor} sites={sites} />
        ) : list.selected ? (
          <DeviceDetail
            device={list.selected}
            canEdit={list.canUpdate && !list.selected.catalogPending}
            onBack={list.clearSelection}
            onEdit={() => void editor.openEdit(list.selected!)}
            completingDutyId={list.completingDutyId}
            onCompleteDuty={(id) => void list.completeDuty(id)}
          />
        ) : (
          <ListPageShell title={t("title")} description={t("description")}>
            <DevicesTable
              list={list}
              onSelect={(device) => void list.selectDevice(device)}
              onEdit={(device) => void editor.openEdit(device)}
            />
          </ListPageShell>
        )}
      </main>
    </div>
  );
}
