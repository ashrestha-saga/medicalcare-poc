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
  shopArticleId?: string;
  gtin?: string;
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
  purpose?: "device" | "parts";
  deviceInstanceId?: string;
  serviceRequestId?: string;
  deliverySiteId?: string;
}

export interface OrderStatusEventDTO {
  id: string;
  externalState: string;
  source: string;
  eventId: string;
  actorName: string | null;
  invoiceRef: string | null;
  netTotal: number | null;
  receivedAt: string;
}

export interface OrderRequestDTO {
  id: string;
  reference: string;
  idempotencyKey: string;
  subjectType: SubjectType | null;
  subjectId: string | null;
  deliveryAddress: string;
  note: string | null;
  approvalState: "pending_approval" | "approved" | "rejected";
  state: "captured";
  raisedBy: string | null;
  createdAt: string;
  updatedAt?: string;
  purpose?: "device" | "parts";
  deviceInstanceId?: string | null;
  /** Resolved inventory device when order was placed for a device / its accessories. */
  device?: {
    id: string;
    inventoryNumber: string;
    label: string;
    href: string;
  } | null;
  externalState?: string;
  externalOrderRef?: string | null;
  externalOrderId?: string | null;
  orderedByName?: string | null;
  netTotalFromSource?: number | null;
  currency?: string | null;
  /** Shop cart totals captured at submit; null when not yet priced by the shop. */
  priceBreakdown?: {
    netSubtotal?: number | null;
    vat?: number | null;
    grossSubtotal?: number | null;
    shipping?: number | null;
    total?: number | null;
    currency?: string | null;
  } | null;
  lastSubmitError?: string | null;
  itemCount?: number;
  items: {
    id: string;
    articleId: string | null;
    articleNumber: string;
    description: string;
    quantity: number;
    unitPrice: number | null;
    gtin?: string | null;
    priceSource?: string;
    quantityConfirmed?: number | null;
  }[];
  statusEvents?: OrderStatusEventDTO[];
}

export interface ShopOrdersSummaryDTO {
  total: number;
  ordered: number;
  submitting: number;
  intent: number;
  shipped: number;
  failed: number;
  other: number;
}

export interface ShopOrdersListResponse {
  orders: OrderRequestDTO[];
  summary: ShopOrdersSummaryDTO;
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
