import type { ClassificationSubmissionDTO } from "./classification";

export type SubjectType = "instance" | "model" | "captured";

export type ServiceRequestState =
  | "captured"
  | "queued"
  | "transmitted"
  | "acknowledged"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "rejected"
  | "handed_off";

/** List scope for GET /api/service-requests. */
export type RequestScope = "mine" | "open" | "all";

export type RequestStateTone = "open" | "work" | "done" | "other";

export interface CreateServiceRequestDTO {
  idempotencyKey: string;
  subjectType: SubjectType;
  subjectId: string;
  serviceType: string;
  priority?: string;
  note?: string;
  site: string;
  /** Location of use — FA-500. */
  locationText: string;
  accessHint?: string;
  contact?: string;
  /** Always separate from locationText, even if identical text — FA-503. */
  deliveryAddress: string;
  /** Attachment ids / data URLs already uploaded or embedded. */
  attachments?: AttachmentInputDTO[];
  raisedBy: string;
  correlationId?: string;
}

export interface AttachmentInputDTO {
  kind: "nameplate" | "fault_photo";
  /** data: URL (already downscaled client-side, NFA-803) or a storage URL. */
  url: string;
}

export interface StatusEventDTO {
  state: ServiceRequestState | string;
  changedAt: string;
  source: string;
  actor: string | null;
  note: string | null;
}

export interface DispatchRecordDTO {
  target: string;
  timestamp: string;
  success: boolean;
  httpStatus: number | null;
  error: string | null;
  attemptCount: number;
  /** Short human-readable note from the adapter response (e.g. simulated mail). */
  detail: string | null;
}

export interface ExecutorOrgDTO {
  id: string;
  code: string;
  name: string;
  kind: "external" | "internal" | string;
  active: boolean;
}

export interface AssignmentDutyContextDTO {
  id: string;
  title: string;
  basisText: string;
  dueAt: string | null;
  inspectionTypeCode: string;
}

/** One protocol step for clinic read-only overview / modal. */
export interface AssignmentProtocolStepDTO {
  position: number;
  label: string;
  inputKind: string;
  unit: string | null;
  measuredValue: string | null;
  withinLimit: boolean | null;
  confirmed: boolean | null;
  note: string | null;
}

/** Sealed inspection / completion summary for clinic request detail. */
export interface AssignmentCompletionOverviewDTO {
  result: "passed" | "passed_with_conditions" | "failed" | string;
  note: string | null;
  /** Calendar performance date (legacy performedAt). */
  completedAt: string | null;
  /** Wall-clock when the inspector started the protocol. */
  startedAt: string | null;
  /** Wall-clock when the protocol was sealed. */
  finishedAt: string | null;
  completedBy: string | null;
  catalogueCode: string | null;
  catalogueLabel: string | null;
  nextDueAt: string | null;
  status: string;
  /** Sealed / completed protocol steps (measurements, checks, notes). */
  protocolSteps: AssignmentProtocolStepDTO[];
}

/** R10 Kostenvoranschlag on a clinic service request. */
export type QuoteDecisionStatus = "open" | "approved" | "rejected";

export interface ServiceRequestQuoteDTO {
  scopeText: string;
  amountText: string;
  decision: QuoteDecisionStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
}

/** List/filter facet — `none` when no Quote row exists. */
export type QuoteFilterStatus = "none" | QuoteDecisionStatus;

export interface ServiceRequestDTO {
  id: string;
  reference: string;
  idempotencyKey: string;
  subjectType: SubjectType;
  subjectId: string;
  serviceType: string;
  priority: string | null;
  note: string | null;
  raisedBy: string | null;
  siteId: string | null;
  locationText: string;
  accessHint: string | null;
  contact: string | null;
  deliveryAddress: string;
  classification: ClassificationSubmissionDTO | null;
  state: string;
  createdAt: string;
  source: "due_date" | "app" | string;
  dutyId: string | null;
  executorOrgId: string | null;
  executorOrg: ExecutorOrgDTO | null;
  allocatedAt: string | null;
  allocatedBy: string | null;
  transmittedAt: string | null;
  allocationLocked: boolean;
  /** Partner disposition — assigned handler. */
  assigneeUserId: string | null;
  assigneeName: string | null;
  /** Partner disposition — appointment (ISO datetime). */
  scheduledAt: string | null;
  deviceName: string | null;
  inventoryNumber: string | null;
  duty: AssignmentDutyContextDTO | null;
  /** Present when an inspection was sealed / assignment completed. */
  completionOverview: AssignmentCompletionOverviewDTO | null;
  /** Partner KV — null when none saved yet. */
  quote: ServiceRequestQuoteDTO | null;
  /** E77 / RD25 — on_site | send_in | external */
  fulfilment: "on_site" | "send_in" | "external" | string;
  /** RD25 — SV Fremdleistung / certificate (when fulfilment=external). */
  external: {
    orgName: string | null;
    commissionedAt: string | null;
    certificateRef: string | null;
    certificateDate: string | null;
    certificateBlobId: string | null;
    result: string | null;
    defectsText: string | null;
  };
  /** E77 — send-in shipment dates (read-only for clinic). */
  sendIn: {
    shippedAt: string | null;
    trackingRef: string | null;
    atWorkshopAt: string | null;
    returnedAt: string | null;
    arrivedAt: string | null;
  };
  /** E78 — post-repair check kind when set. */
  checkType: string | null;
  /** R15 / E72 — follow-up proposal state. */
  proposalState: string;
  mandatory: boolean;
  statusEvents: StatusEventDTO[];
  dispatchRecords: DispatchRecordDTO[];
  attachmentCount: number;
}

export interface RequestDetailProps {
  request: ServiceRequestDTO;
  canWork: boolean;
  canAllocate?: boolean;
  executors?: ExecutorOrgDTO[];
  onBack: () => void;
  onUpdated: (next: ServiceRequestDTO) => void;
  /** Called after a successful withdraw (assignment deleted). */
  onWithdrawn?: () => void;
}

export interface CreateServiceRequestResult {
  request: ServiceRequestDTO;
  /** false when the idempotency key already existed (SS-701 retry). */
  created: boolean;
}

/** Inbound feedback from a downstream system — FA-601/602. */
export interface StatusFeedbackDTO {
  state: ServiceRequestState | string;
  source: string;
  actor?: string;
  note?: string;
  externalReference?: string;
}
