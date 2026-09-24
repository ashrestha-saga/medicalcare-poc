export type PartnerAppRole = "admin" | "inspector" | "order";

export interface ManagementPersonDTO {
  id: string;
  name: string;
  jobTitle: string | null;
  appRole: PartnerAppRole | string;
  email: string;
}

export interface ManagementContractDTO {
  id: string;
  organisationId: string;
  organisationCode: string;
  organisationName: string;
  contact: string | null;
  validFrom: string;
  validTo: string | null;
  /** Normalized scope tokens, e.g. inventory | due-dates | inspection */
  scope: string[];
  people: ManagementPersonDTO[];
}

export interface ManagementOverviewDTO {
  tenantId: string;
  contracts: ManagementContractDTO[];
}
