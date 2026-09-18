import type { DeviceModelDTO, DeviceModelSource } from "./device";

/** Latest classification proposal summary for catalog list/detail. */
export interface CatalogClassificationSummary {
  annex1: boolean | null;
  annex2: boolean | null;
  softwareClass: string | null;
  radiation: boolean | null;
  confidence: string | null;
  source: string | null;
}

/** Per-site distribution of DeviceInstance copies for a model (current tenant only). */
export interface CatalogSpreadRow {
  siteId: string;
  siteName: string;
  copyCount: number;
}

/** DeviceModel row enriched for the central model catalog list. */
export interface CatalogModelListItemDTO extends DeviceModelDTO {
  /** Display title: tradeName → modelName → basicUdiDi → id. */
  displayName: string;
  classification: CatalogClassificationSummary | null;
  /** Linked DeviceInstance count for the logged-in tenant only. */
  copyCount: number;
  /** Distinct clinic sites (within the logged-in tenant) that have copies. */
  siteCount: number;
  /**
   * Identifier completeness 0–100 from basicUdiDi / udiDi / gtins[].
   * Matches the design GTIN column without inventing non-DB fields.
   */
  gtinCoverage: number;
}

/** Full model detail for view/edit (list fields + spread + timestamps). */
export interface CatalogModelDetailDTO extends CatalogModelListItemDTO {
  createdAt: string;
  updatedAt: string;
  spread: CatalogSpreadRow[];
}

export interface CatalogModelImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export type CatalogModelState = DeviceModelDTO["state"];
export type { DeviceModelSource };

/** Local form values for create model dialog. */
export interface CatalogModelFormState {
  tradeName: string;
  modelName: string;
  manufacturer: string;
  manufacturerSrn: string;
  basicUdiDi: string;
  udiDi: string;
  gtins: string;
  riskClass: string;
  emdnCode: string;
  gmdnCode: string;
  source: DeviceModelSource;
  state: CatalogModelState;
  /** Months; empty string in form means unset. */
  maintenanceCycleMonths: string;
}

/** Payload written via create/update catalog APIs (mirrors schema). */
export interface CatalogModelWriteDTO {
  tradeName?: string | null;
  modelName?: string | null;
  manufacturer?: string | null;
  manufacturerSrn?: string | null;
  basicUdiDi?: string | null;
  udiDi?: string | null;
  gtins?: string[];
  riskClass?: string | null;
  emdnCode?: string | null;
  gmdnCode?: string | null;
  source?: DeviceModelSource;
  state?: CatalogModelState;
  maintenanceCycleMonths?: number | null;
  classification?: {
    annex1?: boolean | null;
    annex2?: boolean | null;
    softwareClass?: string | null;
    radiation?: boolean | null;
  };
}

export interface CatalogTableActions {
  canUpdate: boolean;
  onOpen: (model: CatalogModelListItemDTO) => void;
  onEdit: (model: CatalogModelListItemDTO) => void;
}

export interface CatalogModelFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CatalogModelWriteDTO) => Promise<void>;
}

export interface CatalogImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (file: File) => Promise<CatalogModelImportResult>;
}

/** List API surface passed into CatalogTable (from useCatalogModels). */
export interface CatalogModelsListApi {
  models: CatalogModelListItemDTO[];
  q: string;
  setQ: (value: string) => void;
  loading: boolean;
  refresh: (search?: string) => Promise<void>;
  create: (input: CatalogModelWriteDTO) => Promise<CatalogModelListItemDTO>;
  update: (id: string, input: CatalogModelWriteDTO) => Promise<CatalogModelDetailDTO>;
  importFile: (file: File) => Promise<CatalogModelImportResult>;
  canView: boolean;
  canUpdate: boolean;
  selected: CatalogModelDetailDTO | CatalogModelListItemDTO | null;
  selectModel: (model: CatalogModelListItemDTO) => Promise<void>;
  selectModelById: (id: string) => Promise<void>;
  clearSelection: () => void;
  detailLoading: boolean;
  applyUpdated: (model: CatalogModelDetailDTO) => void;
}

export interface CatalogTableProps {
  list: CatalogModelsListApi;
  onSelect: (model: CatalogModelListItemDTO) => void;
  onEdit: (model: CatalogModelListItemDTO) => void;
}

export interface CatalogDetailProps {
  model: CatalogModelDetailDTO | CatalogModelListItemDTO;
  canEdit?: boolean;
  onBack: () => void;
  onEdit?: () => void;
}

/** Badge presentation used by catalog table cells. */
export interface CatalogBadgeDisplay {
  label: string;
  variant?: "success" | "warning" | "destructive" | "outline" | "default" | "secondary";
  className?: string;
}

/** Fixed classification checklist rows shown on detail/edit (maps to proposal fields). */
export interface CatalogClassificationOption {
  id: "annex1" | "annex2" | "softwareIIb" | "softwareC" | "radiation";
  title: string;
  description: string;
  checked: boolean;
}
