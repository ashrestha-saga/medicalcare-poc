export type CameraScannerStatus = "starting" | "running" | "unavailable" | "denied";

export interface CameraScannerProps {
  active: boolean;
  onScan: (raw: string) => void;
}

export interface ManualEntryPanelProps {
  onClose: () => void;
  onSubmit: (raw: string) => void;
}

export interface ManualCaptureFieldErrors {
  name?: string;
  photo?: string;
}

/** Snapshot for post-request inventarize (catalog / BEUDAMED only). */
export interface InventarizeOffer {
  modelId: string;
  tradeName: string | null;
  modelName: string | null;
  udiDi: string | null;
  locationText: string;
  areaId: string | null;
  room: string | null;
  /** Serial from GS1 scan when present. */
  serialHint: string | null;
  commissionedYear: string;
}
