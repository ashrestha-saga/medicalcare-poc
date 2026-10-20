import type { DutyScheduleStatus } from "./registration";

export type DueDatesBoardFilter = "all" | "due" | "overdue" | "unassigned" | "open";

export type DueDatesHorizon = 30 | 90;

export type DueDatesConfidenceFilter = "unverified" | "verified" | "responsible" | "determination" | "derived" | "not_applicable";

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
  dutyKey: string;
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
  /** Total duties matching DB filters (before status chip / q may shrink rows further). */
  totalMatching: number;
  /** True when more rows exist beyond this page. */
  hasMore: boolean;
  limit: number;
  offset: number;
}

export interface DueDatesListQuery {
  q?: string;
  filter?: DueDatesBoardFilter;
  dutyKey?: string;
  /** Exact DeviceDuty id (dashboard band deep-link). */
  dutyId?: string;
  horizon?: number;
  confidence?: DueDatesConfidenceFilter;
  /** When true, only duties with a dueAt. */
  scheduled?: boolean;
  /** Page size (default 100, max 300). */
  limit?: number;
  /** Row offset for pagination. */
  offset?: number;
}
