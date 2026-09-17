import type { ClassificationSubmissionDTO } from "./classification";

export type SubjectType = "instance" | "model" | "captured";

export type ServiceRequestState =
  | "captured"
  | "queued"
  | "transmitted"
  | "acknowledged"
  | "in_progress"
  | "completed"
  | "rejected";

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
  classification?: ClassificationSubmissionDTO;
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
  statusEvents: StatusEventDTO[];
  dispatchRecords: DispatchRecordDTO[];
  attachmentCount: number;
}

export interface RequestDetailProps {
  request: ServiceRequestDTO;
  canWork: boolean;
  onBack: () => void;
  onUpdated: (next: ServiceRequestDTO) => void;
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
