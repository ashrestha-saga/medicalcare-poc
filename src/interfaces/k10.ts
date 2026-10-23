/** K1–K10 DTO types. */

export type BookEntryKind = "malfunction" | "operating_error" | "note";

export interface DeviceBookEntryDTO {
  id: string;
  deviceInstanceId: string;
  inventoryNumber: string | null;
  kind: BookEntryKind;
  occurredAt: string;
  description: string;
  consequence: string | null;
  repeatCount: number | null;
  incidentId: string | null;
  correctsEntryId: string | null;
  recordedBy: string;
  recordedAt: string;
}

export interface DeviceIncidentDTO {
  id: string;
  deviceInstanceId: string | null;
  inventoryNumber: string | null;
  /** tradeName / modelName of the linked instance, when known. */
  deviceLabel: string | null;
  deviceModelId: string | null;
  occurredAt: string;
  noticedAt: string;
  description: string;
  harmDescription: string | null;
  suspectedSerious: boolean | null;
  assessedBy: string | null;
  assessedAt: string | null;
  assessmentNote: string | null;
  reportedAt: string | null;
  reportReference: string | null;
  reportedTo: string | null;
  manufacturerNotifiedAt: string | null;
  measureTaken: string | null;
  closedAt: string | null;
  closedBy: string | null;
  recordedBy: string;
  recordedAt: string;
  assignedUserId: string | null;
  assignedUserName: string | null;
  assignedAt: string | null;
  assignmentDueAt: string | null;
}

/** § 13 composed book — no second store; aggregates existing sources. */
export interface ComposedBookDeviceOptionDTO {
  id: string;
  inventoryNumber: string;
  name: string;
  manufacturer: string | null;
  serialNumber: string | null;
  modelName: string | null;
  basicUdiDi: string | null;
  udiDi: string | null;
  /** Raw GTIN JSON / text from model for client search. */
  gtins: string | null;
  areaName: string | null;
  siteName: string | null;
  room: string | null;
  state: string;
  hasIfu: boolean;
}

export interface ComposedBookDutyDTO {
  id: string;
  dutyKey: string;
  title: string;
  basisText: string;
  lastCompletedAt: string | null;
  dueAt: string | null;
  lastPerformedBy: string | null;
}

export interface ComposedBookTrainingDTO {
  heldOn: string;
  trainingType: string;
  instructorName: string;
  participants: string[];
}

/** Gebrauchsanweisung / IFU from DeviceEvidence (registration or book upload). */
export interface ComposedBookEvidenceDTO {
  id: string;
  prerequisiteCode: string;
  evidenceKind: string;
  attachmentBlobId: string | null;
  contentType: string | null;
  externalRecordRef: string | null;
  recordedBy: string;
  recordedAt: string;
  /** Prefer model document when set (Phase 6). */
  source?: "model_document" | "device_evidence";
  revisionLabel?: string | null;
  openUrl?: string | null;
}

/** Model-level document (IFU on Bauart). */
export interface ModelDocumentDTO {
  id: string;
  deviceModelId: string;
  kind: string;
  revisionLabel: string;
  language: string;
  validFrom: string;
  supersededAt: string | null;
  blobId: string | null;
  externalUrl: string | null;
  recordedByName: string;
  recordedAt: string;
  openUrl: string | null;
}

export interface ComposedBookDTO {
  device: {
    id: string;
    inventoryNumber: string;
    name: string;
    manufacturer: string | null;
    modelName: string | null;
    tradeName: string | null;
    serialNumber: string | null;
    state: string;
    basicUdiDi: string | null;
    udiDi: string | null;
    areaName: string | null;
    siteName: string | null;
    room: string | null;
    modelId?: string | null;
  };
  evidence: ComposedBookEvidenceDTO[];
  /** Current model IFU when present (preferred over instance evidence for open). */
  modelIfu: ModelDocumentDTO | null;
  duties: ComposedBookDutyDTO[];
  trainings: ComposedBookTrainingDTO[];
  entries: DeviceBookEntryDTO[];
  incidents: DeviceIncidentDTO[];
}

export interface FieldSafetyAffectedModelDTO {
  id: string;
  deviceModelId: string | null;
  modelLabel: string | null;
  basicUdiDi: string | null;
  serialFrom: string | null;
  serialTo: string | null;
  lotNumber: string | null;
  note: string | null;
}

export interface FieldSafetyActionDTO {
  id: string;
  reference: string;
  manufacturer: string;
  title: string;
  requiredAction: string;
  issuedAt: string;
  receivedAt: string;
  dueAt: string | null;
  affectedScope: string;
  documentRef: string | null;
  closedAt: string | null;
  recordedBy: string;
  recordedAt: string;
  /** Devices still on Abgleich with affected unknown. */
  unmatchedCount: number;
  /** Affected devices where the required measure is not yet recorded (scan stop). */
  pendingMeasureCount: number;
  deviceActions: FieldSafetyDeviceActionDTO[];
  affectedModels: FieldSafetyAffectedModelDTO[];
  /** Inventory matches from affectedModels not yet on the Abgleich list. */
  suggestedCandidateCount: number;
}

export interface FieldSafetyDeviceActionDTO {
  id: string;
  deviceInstanceId: string;
  inventoryNumber: string | null;
  affected: boolean | null;
  actionTakenAt: string | null;
  actionNote: string | null;
}

export interface RefReprocessingCheckDTO {
  code: string;
  scope: string;
  equipmentTypeCode: string | null;
  label: string;
  cadence: string;
  legalBasis: string | null;
  unit: string | null;
  limitText: string | null;
}

export interface ReprocessingCheckDTO {
  id: string;
  checkCode: string;
  checkLabel: string;
  scope: string;
  equipmentDeviceId: string | null;
  inventoryNumber: string | null;
  siteId: string | null;
  siteName: string | null;
  batchId: string | null;
  performedAt: string;
  performedBy: string;
  passed: boolean | null;
  measuredValue: string | null;
  withinLimit: boolean | null;
  note: string | null;
}

export interface ReprocessingBatchItemDTO {
  label: string | null;
  inventoryNumber: string | null;
  quantity: number;
}

export interface ReprocessingBatchDTO {
  id: string;
  equipmentDeviceId: string;
  inventoryNumber: string | null;
  /** Device display name (trade/model) when known. */
  equipmentLabel: string | null;
  batchNumber: string;
  programme: string | null;
  loadPattern: string | null;
  processRecordRef: string | null;
  startedAt: string;
  finishedAt: string | null;
  releaseResult: "released" | "released_with_conditions" | "rejected" | null;
  releasedBy: string | null;
  releasedAt: string | null;
  releaseNote: string | null;
  itemCount: number;
  items: ReprocessingBatchItemDTO[];
}

export interface ConstancyCadenceDTO {
  id: string;
  deviceInstanceId: string;
  inventoryNumber: string | null;
  deviceLabel: string | null;
  constancyObjectCode: string;
  constancyObjectLabel: string | null;
  intervalValue: number;
  intervalUnit: string;
  basisText: string;
  determinedBy: string;
  determinedAt: string;
  validFrom: string;
  validTo: string | null;
}

export interface MissingConstancyCadenceDTO {
  deviceInstanceId: string;
  inventoryNumber: string;
  deviceLabel: string | null;
  constancyObjectCode: string;
  constancyObjectLabel: string | null;
  /** QS-RL suggestion text — never a frozen dueAt. */
  defaultCadence: string | null;
  dutyId: string;
}

export interface DutyOverlapDecisionDTO {
  id: string;
  deviceInstanceId: string;
  inventoryNumber: string | null;
  coveredDutyKey: string;
  satisfiedByDutyKey: string;
  reasonText: string;
  decidedBy: string;
  decidedAt: string;
  validTo: string | null;
}

export interface AuthorityInspectionDTO {
  id: string;
  siteId: string | null;
  siteName: string | null;
  authorityKind: string;
  authorityName: string;
  legalBasis: string | null;
  announcedAt: string | null;
  visitedAt: string;
  protocolReceivedAt: string | null;
  feeEur: number | null;
  checklistCode: string | null;
  closedAt: string | null;
  findingCount: number;
  openFindingCount: number;
}

export interface AuthorityFindingDTO {
  id: string;
  inspectionId: string;
  itemNo: string | null;
  description: string;
  legalBasis: string | null;
  dueAt: string | null;
  status: string;
  deviceInstanceId: string | null;
  remediationNote: string | null;
  remediatedAt: string | null;
  provenAt: string | null;
}

export interface DisclosureSessionDTO {
  id: string;
  openedAt: string;
  expiresAt: string;
  closedAt: string | null;
  audience: string;
  purpose: string | null;
  scope: string[];
  active: boolean;
}

export type NotificationKindDto =
  | "incident"
  | "finding_remediation"
  | "radiation"
  | "accident"
  | "metrology"
  | "other";

export type NotificationStateDto = "draft" | "sent" | "acknowledged" | "closed" | "withdrawn";

export type NotificationChannelDto =
  | "authority_portal"
  | "manufacturer_portal"
  | "email"
  | "post"
  | "fax"
  | "other";

/** Outbound authority/manufacturer notification (Phase 0). */
export interface AuthorityNotificationDTO {
  id: string;
  kind: NotificationKindDto;
  state: NotificationStateDto;
  recipientName: string;
  channel: NotificationChannelDto;
  authorityKind: string | null;
  incidentId: string | null;
  findingId: string | null;
  deviceInstanceId: string | null;
  siteId: string | null;
  subject: string;
  bodyText: string | null;
  dueAt: string | null;
  sentAt: string | null;
  sentByName: string | null;
  acknowledgedAt: string | null;
  reference: string | null;
  recordedByName: string;
  recordedAt: string;
}

export interface ChecklistPrepDTO {
  code: string;
  label: string;
  authorityKind: string;
  items: Array<{
    position: number;
    label: string;
    legalBasis: string | null;
    mapsToSection: string | null;
    covered: boolean;
    live?: boolean;
  }>;
  coveredCount: number;
  totalCount: number;
  sourceRef?: string | null;
}

/** Live “what a Behörde would miss” row for Begehung prep. */
export interface BegehGapDTO {
  count: number;
  label: string;
  href: string;
}

export type DashboardTileUrgency = "overdue" | "due" | "empty" | "info" | "ok";
export type DashboardTileKind = "arbeit" | "gemischt" | "eigen" | "uebersicht";
export type DashboardSegmentTone = "ok" | "warn" | "muted" | "info";

/** Breakdown slice for “What is on record” segmented bars. */
export interface DashboardTileSegmentDTO {
  key: string;
  count: number;
  tone: DashboardSegmentTone;
  label: string;
}

export interface DashboardTileDTO {
  key: string;
  title: string;
  question: string;
  zone: "decides" | "worklist" | "watch";
  kind: DashboardTileKind;
  sortOrder: number;
  dutyKey: string | null;
  requiredPermission: string | null;
  /** null = not wired yet (mockup “nicht hinterlegt”). */
  count: number | null;
  /** Short status line under the number. */
  label: string;
  urgency: DashboardTileUrgency;
  href: string | null;
  /** Denominator for Bezugsbalken; null ⇒ no meter. */
  denominator: number | null;
  /** Singular|Plural label for denominator (“Gerät|Geräten”). */
  denominatorLabel: string | null;
  hint: string | null;
  /** Optional coloured parts for overview tiles (sums toward count). */
  segments: DashboardTileSegmentDTO[];
}

export interface DashboardBandPointDTO {
  group: "pruefung" | "behoerde" | "rueckruf";
  days: number;
  date: string;
  label: string;
  href: string;
}

export interface DashboardBandGroupDTO {
  key: "pruefung" | "behoerde" | "rueckruf";
  title: string;
  points: DashboardBandPointDTO[];
}

export interface DashboardBoardMetaDTO {
  role: string;
  roleLabel: string;
  workTileCount: number;
  overviewCount: number;
  decidesPoolCount: number;
  overflowCount: number;
  worklistBaseCount: number;
  watchCount: number;
}

export interface DashboardBoardDTO {
  meta: DashboardBoardMetaDTO;
  overview: DashboardTileDTO[];
  decides: DashboardTileDTO[];
  worklist: DashboardTileDTO[];
  watch: DashboardTileDTO[];
  band: DashboardBandGroupDTO[];
}
