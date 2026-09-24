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

export interface InventoryDeviceViewProps {
  resolution: ResolveResponse;
  onService: () => void;
  onParts: () => void;
  onClose: () => void;
}

export interface LocationFormProps {
  errors: Partial<Record<"site" | "room" | "deliveryAddress", string>>;
}
