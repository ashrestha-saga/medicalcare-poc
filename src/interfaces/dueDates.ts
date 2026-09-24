import type { DutyScheduleStatus } from "./registration";

export type DueDatesBoardFilter = "all" | "due" | "overdue" | "unassigned" | "open";

export interface DueDateAssignmentDTO {
  id: string;
  reference: string;
  state: string;
}

export interface DueDateRowDTO {
  id: string;
  deviceInstanceId: string;
  deviceName: string;
  inventoryNumber: string;
  commissionedAt: string | null;
  inspectionTypeCode: string;
  inspectionTypeLabel: string;
  confidence: string;
  confidenceLabel: string;
  basisText: string;
  deadlineAnchor: string;
  deadlineAnchorLabel: string;
  dueAt: string | null;
  lastCompletedAt: string | null;
  status: DutyScheduleStatus;
  assignment: DueDateAssignmentDTO | null;
}

export interface DueDatesSummaryDTO {
  due: number;
  overdue: number;
  unassigned: number;
  openAssignments: number;
}

export interface DueDatesBoardDTO {
  summary: DueDatesSummaryDTO;
  rows: DueDateRowDTO[];
}
