export type RoutineCheckScope = "model" | "product_kind";

export interface RefRoutineCheckDTO {
  code: string;
  scope: RoutineCheckScope;
  deviceModelId: string | null;
  productKindCode: string | null;
  label: string;
  cadence: string;
  checkpoints: Array<{ key: string; text: string }>;
  unit: string | null;
  limitText: string | null;
  basisText: string;
  confidence: string;
  tenantId: string | null;
  /** Reference seed vs tenant determination. */
  isReference: boolean;
  active: boolean;
}

export interface RoutineCheckDTO {
  id: string;
  checkCode: string;
  label: string;
  deviceInstanceId: string;
  performedAt: string;
  performedBy: string;
  passed: boolean | null;
  measuredValue: string | null;
  withinLimit: boolean | null;
  findings: Array<{ key: string; finding: string }>;
  bookEntryId: string | null;
  serviceRequestId: string | null;
}

export interface RoutineDueDeviceDTO {
  deviceInstanceId: string;
  inventoryNumber: string;
  deviceName: string;
  checkCode: string;
  checkLabel: string;
  cadence: string;
}
