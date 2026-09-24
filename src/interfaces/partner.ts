import type { ManagementPersonDTO, PartnerAppRole } from "@/interfaces/management";

export interface PartnerContractedClinicDTO {
  contractId: string;
  tenantId: string;
  tenantName: string;
  validFrom: string;
  validTo: string | null;
  scope: string[];
}

export interface PartnerHomeDTO {
  organisationId: string;
  organisationCode: string;
  organisationName: string;
  contact: string | null;
  myAppRole: PartnerAppRole | string;
  people: ManagementPersonDTO[];
  clinics: PartnerContractedClinicDTO[];
}
