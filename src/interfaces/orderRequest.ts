import type { SubjectType } from "./serviceRequest";

/** A spare part as offered by the catalog (OXID category search or demo fallback). */
export interface SparePartDTO {
  id: string;
  articleNumber: string;
  description: string;
  manufacturer: string | null;
  unitPrice: number | null;
  currency: string;
  /** Model ids this part is known to fit; empty = generic. */
  fitsModelIds: string[];
  category: string;
}

export interface CartItemDTO {
  part: SparePartDTO;
  quantity: number;
}

export interface CreateOrderItemDTO {
  articleId?: string;
  articleNumber: string;
  description: string;
  quantity: number;
  unitPrice?: number | null;
}

export interface CreateOrderRequestDTO {
  idempotencyKey: string;
  subjectType?: SubjectType;
  subjectId?: string;
  deliveryAddress: string;
  note?: string;
  items: CreateOrderItemDTO[];
  raisedBy: string;
  correlationId?: string;
}

export interface OrderRequestDTO {
  id: string;
  reference: string;
  idempotencyKey: string;
  subjectType: SubjectType | null;
  subjectId: string | null;
  deliveryAddress: string;
  note: string | null;
  approvalState: "pending_approval" | "approved" | "rejected" | string;
  state: string;
  raisedBy: string | null;
  createdAt: string;
  items: {
    id: string;
    articleId: string | null;
    articleNumber: string;
    description: string;
    quantity: number;
    unitPrice: number | null;
  }[];
}

export interface CreateOrderRequestResult {
  order: OrderRequestDTO;
  created: boolean;
}

export interface PartsSearchResult {
  key: string;
  parts: SparePartDTO[];
  source: string | null;
}

export interface PartsSearchResponse {
  parts: SparePartDTO[];
  source: string;
}
