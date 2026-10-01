export type OperatingModel = "provider_operated" | "institution_operated";

export type ConsoleActingScope = "managing_org" | "tenant" | "platform" | "other";

export type DispositionDisplayState =
  | "erfasst"
  | "zugewiesen"
  | "terminiert"
  | "in_arbeit"
  | "abgeschlossen"
  | "abgelehnt";

export interface ConsoleClinicDTO {
  tenantId: string;
  tenantCode: string | null;
  tenantName: string;
  city: string | null;
  operatingModel: OperatingModel | string;
  siteCount: number;
  deviceCount: number;
  contractId: string;
  validFrom: string;
  validTo: string | null;
  billingRef: string | null;
  avvRef: string | null;
  scope: string[];
  live: boolean;
  suspendedAt?: string | null;
  terminatedAt?: string | null;
  overdueDuties?: number;
  openClarifications?: number;
  openMpsb?: number;
}

export interface ConsoleClinicListDTO {
  organisationId: string;
  organisationName: string;
  myAppRole: string;
  canCreate: boolean;
  clinics: ConsoleClinicDTO[];
  /** KPI strip for customers list. */
  kpis: {
    customersTotal: number;
    customersLive: number;
    devicesManaged: number;
    overdueDuties: number;
    openClarifications: number;
    openMpsb: number;
  };
}

export type { CreateClinicInput } from "@/schemas/console";

export interface CreateClinicResult {
  clinic: ConsoleClinicDTO;
  invite: {
    email: string;
    emailSimulated: boolean;
    redeemUrl: string;
  };
}

export interface ConsoleClinicDetailDTO extends ConsoleClinicDTO {
  suspendedAt: string | null;
  terminatedAt: string | null;
  /** Primary site address line for institution master. */
  address: string | null;
  /** Organisation.contact on the institution org. */
  contact: string | null;
  mpsbStatus: "appointed" | "open";
  mpsbName: string | null;
  /** True when provider-operated and avvRef empty. */
  avvMissing: boolean;
  /** Partner org staff vs this tenant (no qualifications in this cut). */
  staff: ConsoleClinicStaffRowDTO[];
  /** Open/recent service requests in this tenant. */
  assignments: ConsoleRequestRowDTO[];
}

export interface ConsoleClinicStaffRowDTO {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  jobTitle: string | null;
  appRole: string;
  /** Whether this member may act in the tenant (admins always true). */
  assigned: boolean;
  /** Org admin — access is implicit; assign/revoke UI disabled. */
  accessLocked: boolean;
}

export interface UpdateClinicContractInput {
  validFrom?: string;
  validTo?: string | null;
  billingRef?: string | null;
  avvRef?: string | null;
  operatingModel?: OperatingModel;
  scope?: string[];
}

export interface ConsoleDutyRowDTO {
  tenantId: string;
  tenantCode: string | null;
  tenantName: string;
  dutyId: string;
  inventoryNumber: string | null;
  deviceLabel: string;
  dutyKey: string;
  title: string | null;
  deadlineAnchor: string;
  dueAt: string | null;
  confidence: string;
  overdue: boolean;
}

export interface ConsoleDutyListDTO {
  rows: ConsoleDutyRowDTO[];
}

export interface ConsoleRequestRowDTO {
  tenantId: string;
  tenantCode: string | null;
  tenantName: string;
  reference: string;
  deviceLabel: string;
  serviceType: string;
  state: string;
  executorOrgId: string | null;
  executorName: string | null;
  assigneeUserId: string | null;
  assigneeName: string | null;
  scheduledAt: string | null;
  displayState: DispositionDisplayState;
  raisedAt: string;
  managed: boolean;
}

export interface ConsoleRequestListDTO {
  rows: ConsoleRequestRowDTO[];
}

export interface DispositionAssignInput {
  executorOrgId?: string | null;
  assigneeUserId?: string | null;
  scheduledAt?: string | null;
}

export interface ConsoleStaffMemberDTO {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  jobTitle: string | null;
  appRole: string;
  validFrom: string;
  validTo: string | null;
  isExternal: boolean;
  commissionedFrom: string | null;
  commissionedTo: string | null;
  liabilityUntil: string | null;
  liabilitySumEur: number | null;
  /** Tenant ids this member may act on (all live for admin; assigned subset otherwise). */
  assignedTenantIds: string[];
}

export interface ConsoleStaffListDTO {
  members: ConsoleStaffMemberDTO[];
  clinics: { tenantId: string; tenantName: string; tenantCode: string | null; live: boolean }[];
  canInvite: boolean;
  canAssign: boolean;
}

export interface ConsoleStaffInviteInput {
  email: string;
  name?: string | null;
  appRole: "admin" | "inspector" | "order";
}

export interface ConsoleExternalInviteInput {
  email: string;
  name?: string | null;
  commissionedFrom: string;
  commissionedTo: string;
  liabilityUntil: string;
  liabilitySumEur?: number | null;
}

export interface ConsoleExternalUpdateInput {
  commissionedFrom?: string;
  commissionedTo?: string;
  liabilityUntil?: string;
  liabilitySumEur?: number | null;
  validTo?: string | null;
}

export interface MySitesTenantShellDTO {
  tenantId: string;
  tenantCode: string | null;
  tenantName: string;
  contractId: string | null;
  /** Display line e.g. "53111 Bonn". */
  location: string | null;
  postalCode: string | null;
  /** Rough PLZ band vs depot — unknown when PLZ missing. */
  distanceBand: "nah" | "mittel" | "fern" | "unknown";
}

/** Partner staff assigned to a clinic (PartnerStaffAssignment; admins implied on all live). */
export interface MySitesStaffAssignmentDTO {
  tenantId: string;
  userId: string;
  name: string;
}

/** Managed inspection order used for counts / next due (not for responsibility). */
export interface MySitesInspectionDTO {
  tenantId: string;
  scheduledAt: string | null;
}

export interface MySitesInstitutionDTO extends MySitesTenantShellDTO {
  inspectionCount: number;
  overdueCount: number;
  /** Soonest scheduled appointment (YYYY-MM-DD). */
  nextDue: string | null;
  /** Clinic staff assigned to this institution. */
  assignees: { userId: string; name: string }[];
}

export interface MySitesListDTO {
  /** All live managed institutions (admins) or those the user is assigned to. */
  tenants: MySitesTenantShellDTO[];
  /** Staff ↔ clinic assignments (basis for “Assigned to” + responsibility filter). */
  staffAssignments: MySitesStaffAssignmentDTO[];
  /** Managed inspections for counts / due dates. */
  inspections: MySitesInspectionDTO[];
  /** Partner colleagues selectable in the responsibility filter (admins). */
  colleagues: { userId: string; name: string }[];
  depotLabel: string;
  depotPostalCode: string;
  totalInspections: number;
}

/** One assignment row inside an opened institution (My institutions → Open). */
export interface SiteAssignmentRowDTO {
  reference: string;
  inventoryNumber: string | null;
  serialNumber: string | null;
  deviceLabel: string;
  serviceType: string;
  locationText: string;
  /** Inventory-derived duty due date (DeviceDuty.dueAt), not the appointment. */
  dueAt: string | null;
  overdue: boolean;
  displayState: DispositionDisplayState;
  assigneeUserId: string | null;
  assigneeName: string | null;
  /** True when assignee is the current partner user — only these may be selected/updated. */
  isMine: boolean;
}

export interface SitePortalDTO {
  tenantId: string;
  tenantCode: string | null;
  tenantName: string;
  contractId: string | null;
  location: string | null;
  mineCount: number;
  totalCount: number;
  assignments: SiteAssignmentRowDTO[];
  /** Eligible assignees for own-row updates. */
  assignees: { userId: string; name: string; isExternal: boolean }[];
}

/** @deprecated use MySitesInstitutionDTO — kept for transitional imports */
export interface MySitesGroupDTO {
  tenantId: string;
  tenantCode: string | null;
  tenantName: string;
  contractId: string | null;
  orders: ConsoleRequestRowDTO[];
}

export interface ConsoleAuditRowDTO {
  id: string;
  occurredAt: string;
  actingScope: ConsoleActingScope;
  /** @deprecated use actingScope */
  capacity: "managing_org" | "tenant" | "other";
  actorName: string;
  summary: string;
  resource: string;
  resourceId: string;
  tenantId: string | null;
}

export interface ConsoleAuditListDTO {
  events: ConsoleAuditRowDTO[];
}
