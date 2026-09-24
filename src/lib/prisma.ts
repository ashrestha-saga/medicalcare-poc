import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaVersion?: string;
};

/** Bump when User/schema fields change so next.dev drops a stale client. */
const PRISMA_SCHEMA_VERSION = "training-module-v1";

function createClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// One client per process; recreate when schema version changes after generate.
if (
  !globalForPrisma.prisma ||
  globalForPrisma.prismaSchemaVersion !== PRISMA_SCHEMA_VERSION
) {
  void globalForPrisma.prisma?.$disconnect().catch(() => undefined);
  globalForPrisma.prisma = createClient();
  globalForPrisma.prismaSchemaVersion = PRISMA_SCHEMA_VERSION;
}

export const prisma = globalForPrisma.prisma;
