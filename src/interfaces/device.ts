export type DeviceModelSource = "manual" | "catalog" | "beudamed";

export interface DeviceModelDTO {
  id: string;
  basicUdiDi: string | null;
  udiDi: string | null;
  gtins: string[];
  manufacturer: string | null;
  manufacturerSrn: string | null;
  tradeName: string | null;
  modelName: string | null;
  riskClass: string | null;
  emdnCode: string | null;
  gmdnCode: string | null;
  source: DeviceModelSource;
  sourceFetchedAt: string | null;
  version: number;
  state: "draft" | "review" | "released";
}

export interface DeviceLocationDTO {
  siteId: string | null;
  siteName: string | null;
  areaId: string | null;
  areaName: string | null;
  room: string | null;
  /** Human readable "Site / Area / Room" for pre-filling the location form. */
  text: string;
}

export interface DeviceInstanceDTO {
  id: string;
  inventoryNumber: string;
  serialNumber: string | null;
  manufacturer: string | null;
  modelName: string | null;
  tradeName: string | null;
  modelId: string | null;
  location: DeviceLocationDTO | null;
  commissionedAt: string | null;
  responsiblePerson: string | null;
  /** Confirmed classification on the instance, if one exists. */
  classification: {
    annex1: boolean | null;
    annex2: boolean | null;
    softwareClass: string | null;
    radiation: boolean | null;
    confirmedBy: string | null;
    confirmedAt: string | null;
  } | null;
  /**
   * Display tags for capturer inventory (STK / MTK / StrSchV / …)
   * from confirmed instance classification or latest model proposal.
   */
  inspectionTags: string[];
  createdAt?: string;
  updatedAt?: string;
}

/** Model-level classification shown on inventory detail/edit — never writable from instance forms. */
export interface ModelClassificationDTO {
  annex1: boolean | null;
  annex2: boolean | null;
  softwareClass: string | null;
  radiation: boolean | null;
  confidence: string | null;
  source: string | null;
  instanceCount: number;
}

export interface DeviceCourseEventDTO {
  label: string;
  at: string;
  actor: string | null;
}

/** Detail payload for inventory view / admin edit. */
export interface DeviceInstanceDetailDTO extends DeviceInstanceDTO {
  udiDi: string | null;
  modelSource: DeviceModelSource | null;
  modelState: DeviceModelDTO["state"] | null;
  /** Always from the linked model (proposal/rules) — not editable on the instance. */
  modelClassification: ModelClassificationDTO | null;
  course: DeviceCourseEventDTO[];
}

export type CapturedNumberType = "gtin" | "pzn" | "manufacturer" | "none";

/** DAT-302a — always service-only. */
export interface CapturedArticleDTO {
  id: string;
  name: string;
  manufacturer: string | null;
  number: string | null;
  numberType: CapturedNumberType;
  nameplateAttachmentId: string | null;
  capturedBy: string | null;
  capturedAt: string;
  serviceOnly: true;
}

export interface SiteDTO {
  id: string;
  name: string;
  /** Short site identifier (optional). */
  code: string | null;
  address: string | null;
  /** Goods receiving — spare parts; distinct from deployment address. */
  deliveryAddress: string | null;
  areas: { id: string; name: string }[];
  /** Devices mapped via areas under this site. */
  deviceCount: number;
}
