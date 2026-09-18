import type { DeviceInstanceDTO } from "@/interfaces";

/** Fields rendered on a printable inventory sticker. */
export interface InventoryLabelData {
  inventoryNumber: string;
  /** Display name: trade name → model name → inventory number. */
  name: string;
  serialNumber: string | null;
  /** Formatted next maintenance due date, when known. */
  maintenanceDueLabel: string | null;
}

export function formatMaintenanceDueLabel(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

export function toInventoryLabel(
  device: Pick<
    DeviceInstanceDTO,
    "inventoryNumber" | "serialNumber" | "tradeName" | "modelName" | "nextMaintenanceDueAt"
  >,
): InventoryLabelData {
  const name =
    device.tradeName?.trim() || device.modelName?.trim() || device.inventoryNumber;
  const serial = device.serialNumber?.trim() || null;
  return {
    inventoryNumber: device.inventoryNumber,
    name,
    serialNumber: serial,
    maintenanceDueLabel: formatMaintenanceDueLabel(device.nextMaintenanceDueAt),
  };
}

export function toInventoryLabels(
  devices: Pick<
    DeviceInstanceDTO,
    "inventoryNumber" | "serialNumber" | "tradeName" | "modelName" | "nextMaintenanceDueAt"
  >[],
): InventoryLabelData[] {
  return devices.map(toInventoryLabel);
}
