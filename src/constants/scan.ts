/** Manual-entry identifier kind labels (scan UI). */
export const IDENTIFIER_KIND_LABELS: Record<string, string> = {
  gtin: "GTIN / UDI-DI",
  "udi-di": "UDI (GTIN + production data)",
  inventory: "Inventory number",
  serial: "Serial number",
  unknown: "Free text — will be looked up as inventory or serial number",
};

/** Camera barcode decode loop interval. */
export const SCAN_INTERVAL_MS = 450;

/** Max wait for the camera preview to produce frames. */
export const CAMERA_READY_TIMEOUT_MS = 8_000;
