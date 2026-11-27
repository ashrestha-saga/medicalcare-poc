/** E106 — sealed inspection reports, acknowledgement, device dossier. */

export interface DeviceReportDTO {
  /** DutyPerformance id (acknowledge target). */
  performanceId: string;
  /** InspectionRun id when the performance came from a sealed protocol. */
  runId: string | null;
  dutyTitle: string | null;
  catalogueLabel: string | null;
  source: string;
  result: string;
  performedAt: string;
  performedBy: string;
  /** True when a PDF is available (rendered report or uploaded evidence). */
  hasReport: boolean;
  /** In-app download link (inspection report PDF or attachment). */
  reportUrl: string | null;
  reportSha256: string | null;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
}

export interface DeviceReportsDTO {
  reports: DeviceReportDTO[];
  unacknowledgedCount: number;
}

/** Clinic-wide unacknowledged sealed reports (tile „Berichte ohne Bestätigung”). */
export interface PendingReportDTO extends DeviceReportDTO {
  deviceInstanceId: string;
  inventoryNumber: string;
  deviceName: string | null;
}

export interface PendingReportsDTO {
  reports: PendingReportDTO[];
  count: number;
}

export interface AcknowledgePerformanceResultDTO {
  performanceId: string;
  acknowledgedBy: string;
  acknowledgedAt: string;
}

export interface ReportRenderResultDTO {
  runId: string;
  reportBlobId: string;
  reportSha256: string;
  /** False when a report already existed (idempotent). */
  rendered: boolean;
}

export interface ReportJobResultDTO {
  scanned: number;
  rendered: number;
  failed: number;
}
