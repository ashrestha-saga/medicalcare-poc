"use client";

import { useTranslations } from "next-intl";
import { useClarificationsList } from "@/components/hooks/clarifications/useClarificationsList";
import { useDeviceEditor } from "@/components/hooks/devices/useDeviceEditor";
import { useSites } from "@/components/hooks/location/useSites";
import { DeviceEditForm } from "@/components/features/devices/DeviceEditForm";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { ClarificationsList } from "./ClarificationsList";

/** Data-quality list for inventory devices — clarifications:view (superadmin / device_admin). */
export function ClarificationsScreen() {
  const t = useTranslations("pages.clarifications");
  const tCommon = useTranslations("common");
  const list = useClarificationsList();
  const sites = useSites();
  const editor = useDeviceEditor(() => {
    void list.refresh();
  });

  if (!list.canView) {
    return (
      <div className="p-work" data-testid="clarifications-denied">
        <main className="p-main">
          <ListPageShell title={t("title")} description={tCommon("denied")}>
            <p className="text-sm text-muted-foreground">{tCommon("contactAdmin")}</p>
          </ListPageShell>
        </main>
      </div>
    );
  }

  return (
    <div className="p-work" data-testid="clarifications-page">
      <main className="p-main">
        {editor.open ? (
          <DeviceEditForm form={editor} sites={sites} />
        ) : (
          <ListPageShell title={t("title")} description={t("description")}>
            <ClarificationsList
              summary={list.summary}
              items={list.items}
              loading={list.loading}
              canEdit={list.canUpdate}
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
                  catalogPending: false,
                })
              }
            />
          </ListPageShell>
        )}
      </main>
    </div>
  );
}
