import type { AccountKind } from "./session";

export type ActorKind = AccountKind | "platform" | "system";

export type AuditResource =
  | "device"
  | "request"
  | "order"
  | "user"
  | "role"
  | "site"
  | "area"
  | "catalog_model"
  | "session"
  | "training"
  | "capture"
  | "oxid"
  | "duty"
  | "tenant"
  | "contract"
  | "settings";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "transition"
  | "login"
  | "logout"
  | "login_failed"
  | "grant"
  | "complete"
  | "reset_password"
  | "enable_2fa"
  | "disable_2fa"
  | "connect"
  | "disconnect"
  | "import";

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

/** Snapshot of who acted — persisted as-is on AuditEvent. */
export interface ActorContext {
  tenantId: string | null;
  actorUserId: string | null;
  actorKind: ActorKind;
  actorRole: string | null;
  actorName: string;
  organisationId: string | null;
  organisationName: string | null;
  serviceContractId: string | null;
  correlationId: string | null;
  ip: string | null;
  userAgent: string | null;
}

export interface AuditEventDTO {
  id: string;
  occurredAt: string;
  tenantId: string | null;
  actorUserId: string | null;
  actorKind: ActorKind;
  actorRole: string | null;
  actorName: string;
  organisationId: string | null;
  organisationName: string | null;
  serviceContractId: string | null;
  correlationId: string | null;
  resource: AuditResource | string;
  resourceId: string;
  action: AuditAction | string;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface AuditListQuery {
  resource?: string;
  resourceId?: string;
  actorKind?: string;
  organisationId?: string;
  actorUserId?: string;
  from?: string;
  to?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}

export interface AuditListResponse {
  events: AuditEventDTO[];
  nextCursor: string | null;
}
