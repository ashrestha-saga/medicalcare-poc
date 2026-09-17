"use client";

import { useDevicesList } from "@/components/hooks/devices/useDevicesList";
import { useDeviceEditor } from "@/components/hooks/devices/useDeviceEditor";
import { useSites } from "@/components/hooks/location/useSites";
import { DeviceDetail } from "./DeviceDetail";
import { DeviceEditForm } from "./DeviceEditForm";
import { DevicesTable } from "./devices-table";

/** Tenant device inventory list — gated by inventory:view; edit by inventory:update. */
export function DevicesScreen() {
  const list = useDevicesList();
  const sites = useSites();
  const editor = useDeviceEditor((device) => {
    list.applyUpdated(device);
  });

  if (!list.canView) {
    return (
      <div className="p-work" data-testid="devices-denied">
        <main className="p-main">
          <section className="p-devhead">
            <h2>Inventory</h2>
            <p className="p-requests__sub">You don&apos;t have permission to view inventory.</p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="p-work" data-testid="devices-page">
      <main className="p-main">
        <div className="p-admin">
          {editor.open ? (
            <DeviceEditForm form={editor} sites={sites} />
          ) : list.selected ? (
            <DeviceDetail
              device={list.selected}
              canEdit={list.canUpdate}
              onBack={list.clearSelection}
              onEdit={() => void editor.openEdit(list.selected!)}
            />
          ) : (
            <>
              <section className="p-devhead p-admin__head">
                <div className="p-admin__head-copy">
                  <h2>Inventory</h2>
                  <p className="p-requests__sub">Devices registered for this clinic</p>
                </div>
              </section>
              <DevicesTable
                list={list}
                onSelect={(device) => void list.selectDevice(device)}
                onEdit={(device) => void editor.openEdit(device)}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
