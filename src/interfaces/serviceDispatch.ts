/**
 * Outbound service-request payload for mail + API dispatch (OXID / webhook).
 * Shape matches the PlusOrder / service-desk contract.
 */
export interface ServiceDispatchArticle {
  source: "inventory" | "catalog" | "oxid-catalog" | "beudamed" | "manual" | "unknown";
  name: string | null;
  manufacturer: string | null;
  number: string | null;
  numberType: string | null;
  articleId: string | null;
}

export interface ServiceDispatchClassification {
  confirmed: boolean;
  note: string | null;
}

/** JSON body posted to API dispatch targets. */
export interface ServiceDispatchExport {
  reference: string;
  customer: string | null;
  shipTo: string | null;
  deviceCode: string | null;
  deviceName: string | null;
  /** Tenant inventory number — set for inventory (instance) subjects. */
  inventoryNumber: string | null;
  /** Device serial — set for inventory (instance) subjects when known. */
  serialNumber: string | null;
  location: string | null;
  service: string;
  note: string | null;
  classification: ServiceDispatchClassification;
  site: string | null;
  area: string | null;
  room: string | null;
  accessHint: string | null;
  deliveryAddress: string;
  article: ServiceDispatchArticle;
  raisedBy: string | null;
  createdAt: string;
}

export interface ServiceDispatchEmail {
  to: string;
  subject: string;
  /** Plain-text fallback for clients that do not render HTML. */
  body: string;
  /** HTML body (preferred by most mail clients). */
  html: string;
}

export interface ServiceDispatchContext {
  customerNumber?: string | null;
  companyName?: string | null;
  deliveryLine?: string | null;
}
