import type { ServiceRequestDTO } from "./serviceRequest";
import type { ServiceDispatchContext, ServiceDispatchEmail, ServiceDispatchExport } from "./serviceDispatch";

export type DispatchTargetType = "oxid" | "erp" | "webhook" | "mail";

export interface DispatchTargetDTO {
  id: string;
  tenantId: string;
  type: DispatchTargetType | string;
  name: string;
  endpoint: string | null;
  auth: Record<string, unknown> | null;
  mapping: Record<string, unknown> | null;
  enabled: boolean;
  retryPolicy: { maxAttempts?: number; backoffMs?: number } | null;
}

/** Everything a downstream adapter is allowed to see about a request. */
export interface DispatchableServiceRequest {
  request: ServiceRequestDTO;
  tenantId: string;
  correlationId: string;
  /** Canonical API body for OXID / webhook. */
  exportBody: ServiceDispatchExport;
  /** Formatted mail (An / Betreff / body). */
  email: ServiceDispatchEmail;
  context: ServiceDispatchContext;
}

export interface DispatchResult {
  success: boolean;
  httpStatus?: number;
  /** Sanitized response summary — never credentials, never raw stack traces. */
  response?: Record<string, unknown>;
  error?: string;
}

/** Section 27 — one adapter per DispatchTarget.type. */
export interface DispatchAdapter {
  readonly type: DispatchTargetType | string;
  dispatch(target: DispatchTargetDTO, payload: DispatchableServiceRequest): Promise<DispatchResult>;
}

export interface DispatchOutcome {
  targetId: string;
  target: string;
  result: DispatchResult;
}
