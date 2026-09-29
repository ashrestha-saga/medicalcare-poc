import { PrismaClient } from "@prisma/client";
import { withTenantGuard } from "@/lib/prisma/tenantExtension";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSystem?: PrismaClient;
  prismaSchemaVersion?: string;
};

/** Bump when User/schema fields change so next.dev drops a stale client. */
const PRISMA_SCHEMA_VERSION = "role-grant-kind-v1";

function createBaseClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// One client per process; recreate when schema version changes after generate.
if (
  !globalForPrisma.prisma ||
  !globalForPrisma.prismaSystem ||
  globalForPrisma.prismaSchemaVersion !== PRISMA_SCHEMA_VERSION
) {
  void globalForPrisma.prismaSystem?.$disconnect().catch(() => undefined);
  const base = createBaseClient();
  globalForPrisma.prismaSystem = base;
  // Extended client is structurally compatible at runtime; cast keeps call-site types stable.
  globalForPrisma.prisma = withTenantGuard(base) as unknown as PrismaClient;
  globalForPrisma.prismaSchemaVersion = PRISMA_SCHEMA_VERSION;
}

/** Tenant-guarded client — default for request handlers and services. */
export const prisma = globalForPrisma.prisma!;

/**
 * Unguarded client for seed, cron fan-out, and maintenance scripts.
 * Prefer wrapping call sites in `runWithoutTenant` when using `prisma` instead,
 * or use this when you must bypass the extension entirely.
 */
export const prismaSystem = globalForPrisma.prismaSystem!;
