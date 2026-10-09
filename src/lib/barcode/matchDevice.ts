import type { ParsedIdentifier } from "@/interfaces";

export type DeviceMatchFields = {
  inventoryNumber?: string | null;
  serialNumber?: string | null;
  udiDi?: string | null;
};

function norm(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

/**
 * Compare a parsed scan/manual identifier to device identity fields.
 * Used by inspection verify, site portal filter, and inventory locate.
 */
export function matchesDevice(id: ParsedIdentifier, device: DeviceMatchFields): boolean {
  const inv = norm(device.inventoryNumber);
  const sn = norm(device.serialNumber);
  const udi = norm(device.udiDi);

  if (id.serial) {
    const serial = norm(id.serial);
    if (serial && sn === serial) return true;
  }

  if (id.gtin || id.udiDi) {
    const gtin = norm(id.gtin);
    const udiDi = norm(id.udiDi);
    if (udi && (udi === gtin || udi === udiDi || (gtin && udi.includes(gtin)))) return true;
  }

  const text = norm(id.text ?? (id.kind === "unknown" || id.kind === "inventory" || id.kind === "serial" ? id.raw : ""));
  if (text) {
    if (inv === text || sn === text) return true;
    if (inv.includes(text) || sn.includes(text)) return true;
  }

  const raw = norm(id.raw);
  if (raw && (inv === raw || sn === raw || inv.includes(raw) || sn.includes(raw))) return true;

  return false;
}

/** Extract a stable lookup token for list filters (prefer inventory/serial/gtin). */
export function identifierLookupText(id: ParsedIdentifier): string {
  if (id.serial?.trim()) return id.serial.trim();
  if (id.gtin?.trim()) return id.gtin.trim();
  if (id.udiDi?.trim()) return id.udiDi.trim();
  if (id.text?.trim()) return id.text.trim();
  return id.raw.trim();
}
