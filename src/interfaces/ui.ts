import type { ResolveResponse } from "@/interfaces";

export interface ClassificationPanelProps {
  error?: string | null;
}

export interface CatalogModelViewProps {
  resolution: ResolveResponse;
  onAdopt: () => void;
  onClose: () => void;
}

export interface CatalogActionViewProps {
  resolution: ResolveResponse;
  onService: () => void;
  onParts: () => void;
  onBack: () => void;
  onClose: () => void;
}

export interface BeudamedExternalViewProps {
  resolution: ResolveResponse;
  onAdopt: () => void;
  onClose: () => void;
}

/** Extra K10 actions from the post-scan inventory confirm screen. */
export type InventoryScanExtraAction = "stoerung" | "routine" | "charge" | "ifu";

export interface InventoryDeviceViewProps {
  resolution: ResolveResponse;
  onService: () => void;
  onParts: () => void;
  onClose: () => void;
  /** Report malfunction / daily check / batches / IFU — wired by Scan shell. */
  onExtraAction?: (action: InventoryScanExtraAction) => void;
}

export interface InventoryCandidatesViewProps {
  resolution: ResolveResponse;
  onSelect: (deviceId: string) => void;
  onSkip: () => void;
  onClose: () => void;
  selecting?: boolean;
  selectError?: string | null;
}

export interface LocationFormProps {
  errors: Partial<Record<"site" | "room" | "deliveryAddress", string>>;
}
