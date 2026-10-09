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
  /** Partner org staff vs this tenant. */
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
  qualifications: { id: string; code: string; label: string; validUntil: string | null }[];
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
  /** Primary device line (trade name / model / inventory). */
  deviceLabel: string;
  /** Secondary device line (model or inventory), when distinct. */
  deviceDetail: string | null;
  serviceType: string;
  state: string;
  executorOrgId: string | null;
  executorName: string | null;
  /** Short contractor code (e.g. MSR from O-MSR). */
  executorCode: string | null;
  assigneeUserId: string | null;
  assigneeName: string | null;
  scheduledAt: string | null;
  displayState: DispositionDisplayState;
  /** Next console-advanceable display state, or null when done / rejected / awaiting Prüfpartner. */
  nextDisplayState: DispositionDisplayState | null;
  raisedAt: string;
  managed: boolean;
  /** True when the caller's partner organisation is the executing contractor. */
  isExecutor: boolean;
}

export interface ConsoleRequestListDTO {
  rows: ConsoleRequestRowDTO[];
}

export interface DispositionAssignInput {
  executorOrgId?: string | null;
  assigneeUserId?: string | null;
  scheduledAt?: string | null;
}

export interface ConsoleStaffQualificationDTO {
  id: string;
  code: string;
  label: string;
  validUntil: string | null;
  evidenceRef: string | null;
}

export interface ConsoleStaffSkillDTO {
  id: string;
  skillCode: string;
  skillLabel: string;
  levelCode: string;
  levelLabel: string;
  validUntil: string | null;
  evidenceRef: string | null;
}

export interface ConsoleStaffExpiringItemDTO {
  membershipId: string;
  personName: string;
  kind: "qualification" | "skill";
  label: string;
  /** Present when kind is skill — for i18n level label. */
  skillLevelCode?: string | null;
  validUntil: string;
}

export interface ConsoleStaffMemberDTO {
  /** Active: OrgMembership id. Invited: `invite:{invitationId}`. */
  membershipId: string;
  /** Null while invite pending. */
  userId: string | null;
  name: string;
  email: string;
  jobTitle: string | null;
  appRole: string;
  validFrom: string | null;
  validTo: string | null;
  isExternal: boolean;
  commissionedFrom: string | null;
  commissionedTo: string | null;
  liabilityUntil: string | null;
  liabilitySumEur: number | null;
  /** Tenant ids this member may act on (all live for admin; assigned subset otherwise). */
  assignedTenantIds: string[];
  status: "active" | "invited";
  dispatchOrigin: "home" | "partner_site" | "organisation" | null;
  originPostalCode: string | null;
  originCity: string | null;
  radiusKm: number | null;
  qualifications: ConsoleStaffQualificationDTO[];
  skills: ConsoleStaffSkillDTO[];
  assignedClinicNames: string[];
  invitationExpiresAt?: string | null;
  /** Employer firm when isExternal (Radiotec etc.). */
  employerOrganisationId?: string | null;
  employerName?: string | null;
  employerCode?: string | null;
  /** External: commission + liability still valid. */
  deployable?: boolean;
  notDeployableReason?: string | null;
}

export interface ConsoleExternalNotDeployableDTO {
  membershipId: string;
  personName: string;
  reason: string;
}

export interface ConsoleExternalEmployerOptionDTO {
  id: string;
  name: string;
  code: string;
}

export interface ConsoleExternalListDTO {
  members: ConsoleStaffMemberDTO[];
  notDeployable: ConsoleExternalNotDeployableDTO[];
  employerOptions: ConsoleExternalEmployerOptionDTO[];
  refs: ConsoleStaffRefsDTO;
  canManage: boolean;
}

export interface ConsoleExternalInviteInput {
  email: string;
  name?: string | null;
  employerOrganisationId: string;
  commissionedFrom: string;
  commissionedTo: string;
  liabilityUntil: string;
  liabilitySumEur?: number | null;
  originPostalCode?: string | null;
  originCity?: string | null;
  radiusKm?: number | null;
  skills?: ConsoleStaffSkillDraftInput[];
}

export interface ConsoleExternalUpdateInput {
  name?: string;
  employerOrganisationId?: string | null;
  commissionedFrom?: string;
  commissionedTo?: string;
  liabilityUntil?: string;
  liabilitySumEur?: number | null;
  originPostalCode?: string | null;
  originCity?: string | null;
  radiusKm?: number | null;
  validTo?: string | null;
}

export interface ConsoleStaffRefsDTO {
  qualifications: { code: string; label: string }[];
  skills: { code: string; label: string }[];
  skillLevels: { code: string; label: string; rank: number }[];
}

export interface ConsoleStaffListDTO {
  members: ConsoleStaffMemberDTO[];
  clinics: {
    tenantId: string;
    tenantName: string;
    tenantCode: string | null;
    live: boolean;
    city?: string | null;
  }[];
  canInvite: boolean;
  canAssign: boolean;
  expiringSoon: ConsoleStaffExpiringItemDTO[];
  refs: ConsoleStaffRefsDTO;
}

export interface ConsoleStaffSkillDraftInput {
  skillCode: string;
  levelCode: string;
  validUntil?: string | null;
  evidenceRef?: string | null;
}

export interface ConsoleStaffInviteInput {
  email: string;
  name?: string | null;
  appRole: "admin" | "inspector" | "order";
  jobTitle?: string | null;
  validFrom?: string | null;
  dispatchOrigin?: "home" | "partner_site" | "organisation" | null;
  originPostalCode?: string | null;
  originCity?: string | null;
  radiusKm?: number | null;
  skills?: ConsoleStaffSkillDraftInput[];
}

export interface ConsoleStaffPatchInput {
  name?: string;
  jobTitle?: string | null;
  appRole?: "admin" | "inspector" | "order";
  validFrom?: string;
  dispatchOrigin?: "home" | "partner_site" | "organisation";
  originPostalCode?: string | null;
  originCity?: string | null;
  radiusKm?: number | null;
}

export interface ConsoleStaffSkillCreateInput {
  skillCode: string;
  levelCode: string;
  validUntil?: string | null;
  evidenceRef?: string | null;
}

export interface ConsoleStaffQualificationCreateInput {
  qualificationCode: string;
  validUntil?: string | null;
  evidenceRef?: string | null;
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
  /** True when the caller's organisation is the executing contractor for this row. */
  isExecutor: boolean;
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
