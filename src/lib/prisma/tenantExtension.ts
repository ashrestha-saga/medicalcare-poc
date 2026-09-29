import { Prisma, PrismaClient } from "@prisma/client";
import { getTenantStore } from "@/lib/auth/tenantStore";

/**
 * Models that always carry tenantId and must be filtered / stamped by the extension.
 * Global / non-tenant models (Ref*, RoleGrant, Organisation, DeviceModel, …) are omitted.
 */
export const TENANT_SCOPED_MODELS = new Set([
  "TenantOxidConnection",
  "Site",
  "Area",
  "SiteHeadcount",
  "SafetyOfficerAppointment",
  "DeviceInstance",
  "MaintenanceEvent",
  "CapturedArticle",
  "DeviceReleaseSnapshot",
  "DeviceDuty",
  "DutyPerformance",
  "ServiceContract",
  "TrainingEvent",
  "TrainingRecord",
  "ExecutorOrg",
  "DeviceUnitEvent",
  "DeviceReprocessingProfile",
  "ServiceRequest",
  "StatusEvent",
  "Attachment",
  "AttachmentBlob",
  "DispatchTarget",
  "DispatchRecord",
  "OrderRequest",
  "OrderItem",
  "DutyReminder",
  "DispatchOutbox",
  "DeviceClarification",
  "DeviceEvidence",
  "ReprocessingOnDevice",
  "UserInvitation",
  "PasswordResetToken",
]);

const READ_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

const WRITE_OPS = new Set(["create", "createMany", "update", "updateMany", "delete", "deleteMany", "upsert"]);

function shouldGuard(model: string | undefined): boolean {
  if (!model || !TENANT_SCOPED_MODELS.has(model)) return false;
  const store = getTenantStore();
  if (store?.bypass) return false;
  // No ALS: allow in test (vitest isolates do not inherit setup enterWith).
  // In production/dev, missing context is a hard error when we reach requireTenantId.
  if (!store && process.env.NODE_ENV === "test") return false;
  return true;
}

function requireTenantId(): string {
  const store = getTenantStore();
  if (!store) {
    throw new Error(
      "SEC-01: Prisma query on a tenant-scoped model without tenant context. Use requireTenantContext or runWithoutTenant.",
    );
  }
  if (store.bypass) {
    throw new Error("SEC-01: bypass flag set but requireTenantId was called.");
  }
  if (!store.tenantId) {
    throw new Error("SEC-01: tenant context is empty.");
  }
  return store.tenantId;
}

function mergeWhere(args: { where?: Record<string, unknown> } | undefined, tenantId: string) {
  const where = { ...(args?.where ?? {}) };
  // Never allow a caller to widen past the session tenant.
  where.tenantId = tenantId;
  return where;
}

function stampCreateData(
  data: Record<string, unknown> | Record<string, unknown>[] | undefined,
  tenantId: string,
): Record<string, unknown> | Record<string, unknown>[] | undefined {
  if (!data) return data;
  if (Array.isArray(data)) {
    return data.map((row) => ({ ...row, tenantId }));
  }
  return { ...data, tenantId };
}

/**
 * Prisma client extension that injects tenantId from AsyncLocalStorage.
 * Cross-tenant queries without bypass throw; they never return empty results silently.
 */
export function withTenantGuard(client: PrismaClient) {
  return client.$extends({
    name: "tenantGuard",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!shouldGuard(model)) {
            return query(args);
          }

          // Bypass path: seed / jobs that opted into runWithoutTenant.
          const store = getTenantStore();
          if (store?.bypass) {
            return query(args);
          }

          const tenantId = requireTenantId();
          const nextArgs = { ...(args as Record<string, unknown>) } as Record<string, unknown>;

          if (READ_OPS.has(operation) || operation === "update" || operation === "updateMany" || operation === "delete" || operation === "deleteMany") {
            nextArgs.where = mergeWhere(nextArgs as { where?: Record<string, unknown> }, tenantId);
          }

          if (operation === "create") {
            nextArgs.data = stampCreateData(nextArgs.data as Record<string, unknown>, tenantId);
          }
          if (operation === "createMany") {
            nextArgs.data = stampCreateData(nextArgs.data as Record<string, unknown>[], tenantId);
          }
          if (operation === "upsert") {
            nextArgs.where = mergeWhere(nextArgs as { where?: Record<string, unknown> }, tenantId);
            nextArgs.create = stampCreateData(nextArgs.create as Record<string, unknown>, tenantId);
            const update = { ...((nextArgs.update as Record<string, unknown>) ?? {}) };
            // Do not allow switching tenant on upsert update.
            delete update.tenantId;
            nextArgs.update = update;
          }

          return query(nextArgs);
        },
      },
    },
  });
}

export type TenantGuardedPrisma = ReturnType<typeof withTenantGuard>;

/** Models without tenantId that must never be queried via the guard path for isolation tests. */
export function isTenantScopedModel(name: string): boolean {
  return TENANT_SCOPED_MODELS.has(name);
}

// Keep Prisma namespace import used for typing consumers.
export type { Prisma };
