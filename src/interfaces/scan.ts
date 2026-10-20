/** Heute worklist band — v3 sort: blocked → open → notice → done. */
export type ScanHeuteBand = "blocked" | "open" | "notice" | "done";

export interface ScanHeuteItemDTO {
  deviceId: string;
  inventoryNumber: string;
  label: string;
  areaName: string | null;
  siteName: string | null;
  room: string | null;
  state: "draft" | "review" | "released" | "retired";
  band: ScanHeuteBand;
  /** Open unreleased batches on this device (equipment). */
  openBatchCount: number;
  /** True when daily reprocessing catalogue items remain open (tenant stub). */
  openDailyChecks: boolean;
  /** True when a constancy duty is due/overdue or last check failed. */
  openKonstanzChecks: boolean;
}

export interface ScanHeuteDTO {
  items: ScanHeuteItemDTO[];
  /** Caller’s effective area ids; empty when unscoped (admin) or none assigned. */
  areaIds: string[] | null;
  unscoped: boolean;
}

export type ScanActionCtx =
  | "stoerung"
  | "service"
  | "routine"
  | "charge"
  | "charge-neu"
  | "konstanz"
  | "anfragen"
  | "ersatz"
  | "info"
  | "ifu";

export interface ScanPrimaryActionDTO {
  ctx: ScanActionCtx;
  titleKey: string;
  textKey: string;
  tone: "ok" | "warn" | "stop";
  servicePrefill?: "reparatur";
  infoOnly?: boolean;
  batchId?: string;
}

export interface ScanFurtherActionDTO {
  ctx: ScanActionCtx;
  titleKey: string;
  textKey: string;
  batchId?: string;
  /** Optional i18n param (e.g. IFU document name). */
  ref?: string;
}

export interface ScanDeviceCardDTO {
  deviceId: string;
  inventoryNumber: string;
  serialNumber: string | null;
  label: string;
  manufacturer: string | null;
  state: "draft" | "review" | "released" | "retired";
  siteName: string | null;
  areaName: string | null;
  room: string | null;
  sperrLage: "ok" | "stop" | "warn";
  sperrQuelle: "stoerung" | "routine" | "konstanz" | "rueckruf" | null;
  sperrGrund: string | null;
  openBatchCount: number;
  openDailyChecks: boolean;
  openKonstanzChecks: boolean;
  openRequestRef: string | null;
  /** Gebrauchsanweisung label when § 4 evidence exists. */
  ifuLabel: string | null;
  primary: ScanPrimaryActionDTO;
  further: ScanFurtherActionDTO[];
}

export interface ScanStoerungResultDTO {
  entryId: string;
  incidentId: string | null;
  inventoryNumber: string;
  kind: "malfunction" | "operating_error" | "note";
  outOfService: boolean;
  harm: "yes" | "no" | "unknown";
}

export type ScanRoutineStepKind = "pass_fail" | "measure";

export interface ScanRoutineStepDTO {
  checkCode: string;
  label: string;
  scope: string;
  unit: string | null;
  limitText: string | null;
  kind: ScanRoutineStepKind;
}

export interface ScanRoutineOpenDTO {
  deviceId: string;
  inventoryNumber: string;
  label: string;
  siteId: string | null;
  siteName: string | null;
  areaName: string | null;
  isEquipment: boolean;
  steps: ScanRoutineStepDTO[];
  performedAt: string;
}

export interface ScanRoutineResultDTO {
  deviceId: string;
  inventoryNumber: string;
  checkCount: number;
  hasMangel: boolean;
  performedAt: string;
  lines: { label: string; value: string }[];
}

export type ScanBatchReleaseResult = "released" | "released_with_conditions" | "rejected";

export interface ScanChargeListItemDTO {
  id: string;
  batchNumber: string;
  programme: string | null;
  startedAt: string;
  finishedAt: string | null;
  releaseResult: ScanBatchReleaseResult | null;
  hasBeleg: boolean;
  equipmentDeviceId: string;
  inventoryNumber: string;
  label: string;
}

export interface ScanChargeListDTO {
  items: ScanChargeListItemDTO[];
}

export interface ScanChargeBelegDTO {
  blobId: string | null;
  sha256: string | null;
  byteSize: number | null;
  ref?: string;
}

export interface ScanChargeDetailDTO {
  id: string;
  batchNumber: string;
  programme: string | null;
  loadPattern: string | null;
  startedAt: string;
  finishedAt: string | null;
  releaseResult: string | null;
  releaseNote: string | null;
  releasedBy: string | null;
  releasedById: string | null;
  releasedAt: string | null;
  equipmentDeviceId: string;
  inventoryNumber: string;
  label: string;
  isEquipment: boolean;
  beleg: ScanChargeBelegDTO | null;
  items: { label: string | null; quantity: number; deviceInstanceId: string | null }[];
  /** Human-readable gates blocking unconditional release. */
  hurdles: string[];
  perBatchChecks: ScanRoutineStepDTO[];
}

export interface ScanChargeReleaseResultDTO {
  batchId: string;
  batchNumber: string;
  inventoryNumber: string;
  releaseResult: ScanBatchReleaseResult;
  releasedBy: string;
  releasedAt: string;
  belegSha256: string | null;
  releaseNote: string | null;
}

export type ScanKonstanzItemStatus =
  | "due"
  | "overdue"
  | "failed"
  | "missing_cadence"
  | "baseline_missing"
  | "ok";

export interface ScanKonstanzItemDTO {
  dutyId: string;
  title: string;
  constancyObjectCode: string | null;
  constancyObjectLabel: string | null;
  dueAt: string | null;
  status: ScanKonstanzItemStatus;
  canComplete: boolean;
  requiresBaseline: boolean;
  lastResult: string | null;
  lastPerformedAt: string | null;
  basisText: string;
}

export interface ScanKonstanzOpenDTO {
  deviceId: string;
  inventoryNumber: string;
  label: string;
  performedAt: string;
  items: ScanKonstanzItemDTO[];
}

export interface ScanKonstanzResultDTO {
  deviceId: string;
  inventoryNumber: string;
  dutyId: string;
  title: string;
  result: "passed" | "passed_with_conditions" | "failed";
  performedAt: string;
  nextDueAt: string | null;
  note: string | null;
}

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
  /** Model default cycle (months); inventarize may override. */
  maintenanceCycleMonths: number | null;
}
