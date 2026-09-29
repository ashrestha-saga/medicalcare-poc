export type OperatingModel = "provider_operated" | "institution_operated";

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
  scope: string[];
  live: boolean;
  suspendedAt?: string | null;
  terminatedAt?: string | null;
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
  };
}

export interface CreateClinicInput {
  name: string;
  street?: string;
  postalCode?: string;
  city: string;
  country?: string;
  tenantCode: string;
  siteName: string;
  validFrom: string;
  billingRef?: string;
  operatingModel: OperatingModel;
  scope: string[];
}

export interface CreateClinicResult {
  clinic: ConsoleClinicDTO;
}

export interface ConsoleClinicDetailDTO extends ConsoleClinicDTO {
  suspendedAt: string | null;
  terminatedAt: string | null;
}

export interface UpdateClinicContractInput {
  validFrom?: string;
  validTo?: string | null;
  billingRef?: string | null;
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
  executorName: string | null;
  raisedAt: string;
}

export interface ConsoleRequestListDTO {
  rows: ConsoleRequestRowDTO[];
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
  /** Tenant ids this member may act on (all live contracts for admin; assigned subset later). */
  assignedTenantIds: string[];
}

export interface ConsoleStaffListDTO {
  members: ConsoleStaffMemberDTO[];
  clinics: { tenantId: string; tenantName: string; tenantCode: string | null; live: boolean }[];
  canInvite: boolean;
}

export interface ConsoleStaffInviteInput {
  email: string;
  name?: string | null;
  appRole: "admin" | "inspector" | "order";
}

export interface ConsoleAuditRowDTO {
  id: string;
  occurredAt: string;
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
