import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  ActorContext,
  AuditAction,
  AuditEventDTO,
  AuditListQuery,
  AuditListResponse,
  AuditResource,
} from "@/interfaces/audit";
import type { TenantWorkContext } from "@/interfaces/session";
import { requirePermission } from "@/lib/auth/tenantContext";
import { errorMessage, logger, redact } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { notFound, unprocessable } from "@/lib/errors";

const EXTRA_SENSITIVE = /(totp|backup|passwordhash|accesstoken|refreshtoken|secretenc)/i;
const EXPORT_CAP = 5000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export type AuditDb = Pick<PrismaClient, "auditEvent"> | Prisma.TransactionClient;

export interface RecordAuditInput {
  actor: ActorContext;
  resource: AuditResource | string;
  resourceId: string;
  action: AuditAction | string;
  summary: string;
  before?: unknown;
  after?: unknown;
  /** If true, insert failures rethrow (use inside security transactions). */
  required?: boolean;
}

const AUDIT_DENY_KEYS = new Set([
  "password",
  "passwordHash",
  "newPassword",
  "adminPassword",
  "pass",
  "passEnc",
  "totpSecretEnc",
  "totpPendingEnc",
  "totpBackupHashes",
  "accessToken",
  "refreshToken",
  "accessTokenEnc",
  "refreshTokenEnc",
  "secret",
]);

export function sanitizeAuditValue(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || value === undefined) return value ?? null;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => sanitizeAuditValue(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (AUDIT_DENY_KEYS.has(k) || EXTRA_SENSITIVE.test(k)) {
      out[k] = "[REDACTED]";
      continue;
    }
    out[k] = sanitizeAuditValue(v, depth + 1);
  }
  return redact(out);
}

export function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const prev: Record<string, unknown> = {};
  const next: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null)) {
      prev[key] = before[key] ?? null;
      next[key] = after[key] ?? null;
    }
  }
  if (Object.keys(next).length === 0) return null;
  return { before: prev, after: next };
}

function serializePayload(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0) {
    return null;
  }
  return JSON.stringify(sanitizeAuditValue(value));
}

function parseJson(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return null;
  }
}

function toDTO(row: {
  id: string;
  occurredAt: Date;
  tenantId: string | null;
  actorUserId: string | null;
  actorKind: string;
  actorRole: string | null;
  actorName: string;
  organisationId: string | null;
  organisationName: string | null;
  serviceContractId: string | null;
  correlationId: string | null;
  resource: string;
  resourceId: string;
  action: string;
  summary: string;
  before: string | null;
  after: string | null;
}): AuditEventDTO {
  return {
    id: row.id,
    occurredAt: row.occurredAt.toISOString(),
    tenantId: row.tenantId,
    actorUserId: row.actorUserId,
    actorKind: row.actorKind as AuditEventDTO["actorKind"],
    actorRole: row.actorRole,
    actorName: row.actorName,
    organisationId: row.organisationId,
    organisationName: row.organisationName,
    serviceContractId: row.serviceContractId,
    correlationId: row.correlationId,
    resource: row.resource,
    resourceId: row.resourceId,
    action: row.action,
    summary: row.summary,
    before: parseJson(row.before),
    after: parseJson(row.after),
  };
}

export async function recordAudit(input: RecordAuditInput, client: AuditDb = prisma): Promise<void> {
  try {
    await client.auditEvent.create({
      data: {
        tenantId: input.actor.tenantId,
        actorUserId: input.actor.actorUserId,
        actorKind: input.actor.actorKind,
        actorRole: input.actor.actorRole,
        actorName: input.actor.actorName,
        organisationId: input.actor.organisationId,
        organisationName: input.actor.organisationName,
        serviceContractId: input.actor.serviceContractId,
        correlationId: input.actor.correlationId,
        ip: input.actor.ip,
        userAgent: input.actor.userAgent,
        resource: input.resource,
        resourceId: input.resourceId,
        action: input.action,
        summary: input.summary.slice(0, 2000),
        before: serializePayload(input.before),
        after: serializePayload(input.after),
      },
    });
  } catch (error) {
    logger.warn("audit.write_failed", {
      error: errorMessage(error),
      resource: input.resource,
      action: input.action,
    });
    if (input.required) throw error;
  }
}

function parseDate(value: string | undefined, label: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw unprocessable(`Invalid ${label} date.`, { field: label });
  return d;
}

function listWhere(tenantId: string, query: AuditListQuery): Prisma.AuditEventWhereInput {
  const from = parseDate(query.from, "from");
  const to = parseDate(query.to, "to");
  const q = query.q?.trim();
  return {
    tenantId,
    ...(query.resource ? { resource: query.resource } : {}),
    ...(query.resourceId ? { resourceId: query.resourceId } : {}),
    ...(query.actorKind ? { actorKind: query.actorKind } : {}),
    ...(query.organisationId ? { organisationId: query.organisationId } : {}),
    ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
    ...(from || to
      ? {
          occurredAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { summary: { contains: q } },
            { actorName: { contains: q } },
            { resourceId: { contains: q } },
            { action: { contains: q } },
          ],
        }
      : {}),
  };
}

export const auditService = {
  async list(ctx: TenantWorkContext, query: AuditListQuery = {}): Promise<AuditListResponse> {
    requirePermission(ctx, "audit:view");
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const where = listWhere(ctx.tenantId, query);

    if (query.cursor) {
      const cursorRow = await prisma.auditEvent.findFirst({
        where: { id: query.cursor, tenantId: ctx.tenantId },
        select: { id: true, occurredAt: true },
      });
      if (!cursorRow) throw notFound("Audit cursor not found.");
      where.AND = [
        {
          OR: [
            { occurredAt: { lt: cursorRow.occurredAt } },
            { occurredAt: cursorRow.occurredAt, id: { lt: cursorRow.id } },
          ],
        },
      ];
    }

    const rows = await prisma.auditEvent.findMany({
      where,
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      events: page.map(toDTO),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    };
  },

  async listForResource(
    ctx: TenantWorkContext,
    resource: string,
    resourceId: string,
    limit = 100,
  ): Promise<AuditEventDTO[]> {
    requirePermission(ctx, "audit:view");
    const rows = await prisma.auditEvent.findMany({
      where: { tenantId: ctx.tenantId, resource, resourceId },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: Math.min(Math.max(limit, 1), MAX_LIMIT),
    });
    return rows.map(toDTO);
  },

  async exportCsv(ctx: TenantWorkContext, query: AuditListQuery = {}): Promise<string> {
    requirePermission(ctx, "audit:export");
    const where = listWhere(ctx.tenantId, query);
    const rows = await prisma.auditEvent.findMany({
      where,
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: EXPORT_CAP,
    });
    const header = [
      "occurredAt",
      "tenantId",
      "actorKind",
      "actorName",
      "actorRole",
      "organisationName",
      "action",
      "resource",
      "resourceId",
      "summary",
      "correlationId",
    ];
    const lines = [header.join(",")];
    for (const row of rows) {
      const cells = [
        row.occurredAt.toISOString(),
        row.tenantId ?? "",
        row.actorKind,
        row.actorName,
        row.actorRole ?? "",
        row.organisationName ?? "",
        row.action,
        row.resource,
        row.resourceId,
        row.summary,
        row.correlationId ?? "",
      ].map(csvEscape);
      lines.push(cells.join(","));
    }
    return lines.join("\n");
  },
};

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
