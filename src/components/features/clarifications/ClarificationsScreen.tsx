"use client";

import { useClarificationsList } from "@/components/hooks/clarifications/useClarificationsList";
import { useDeviceEditor } from "@/components/hooks/devices/useDeviceEditor";
import { useSites } from "@/components/hooks/location/useSites";
import { DeviceEditForm } from "@/components/features/devices/DeviceEditForm";
import { ClarificationsList } from "./ClarificationsList";

/** Data-quality list for inventory devices — clarifications:view (superadmin / device_admin). */
export function ClarificationsScreen() {
  const list = useClarificationsList();
  const sites = useSites();
  const editor = useDeviceEditor(() => {
    void list.refresh();
  });

  if (!list.canView) {
    return (
      <div className="p-work" data-testid="clarifications-denied">
        <main className="p-main">
          <section className="p-devhead">
            <h2>Clarifications</h2>
            <p className="p-requests__sub">You don&apos;t have permission to view the clarification list.</p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="p-work" data-testid="clarifications-page">
      <main className="p-main">
        <div className="p-admin">
          {editor.open ? (
            <DeviceEditForm form={editor} sites={sites} />
          ) : (
            <>
              <section className="p-devhead p-admin__head">
                <div className="p-admin__head-copy">
                  <h2>Clarifications</h2>
                  <p className="p-requests__sub">
                    Inventory devices with missing or weak master data — review and correct here.
                  </p>
                </div>
              </section>
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
                  })
                }
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
