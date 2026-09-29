import { execSync } from "node:child_process";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { seed } from "../prisma/seed";

/**
 * Prepares the MySQL test database once per run: drop tables + schema push + seed.
 * Uses TEST_DATABASE_URL when set; otherwise DATABASE_URL from .env.
 * Prefer a dedicated TEST_DATABASE_URL so local app data is not wiped.
 */
export default async function globalSetup() {
  const root = path.resolve(__dirname, "..");
  loadEnv({ path: path.join(root, ".env") });

  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl || !databaseUrl.startsWith("mysql")) {
    throw new Error(
      "globalSetup requires MySQL DATABASE_URL or TEST_DATABASE_URL in .env",
    );
  }
  process.env.DATABASE_URL = databaseUrl;

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    await dropAllTables(prisma);
  } finally {
    await prisma.$disconnect();
  }

  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: root,
    env: { ...process.env },
    stdio: "pipe",
  });

  const prisma2 = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    // SEC-06 — db push does not create triggers; install append-only guards for tests.
    // Some MySQL proxies (Vitess / prepared-statement only) reject DDL via Prisma's
    // prepared protocol (error 1295) — soft-fail so seed + API tests still run.
    await installAuditAppendOnlyTriggers(prisma2);
    await seed(prisma2);
  } finally {
    await prisma2.$disconnect();
  }
}

async function installAuditAppendOnlyTriggers(prisma: PrismaClient) {
  try {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS AuditEvent_no_update`);
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS AuditEvent_no_delete`);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER AuditEvent_no_update
        BEFORE UPDATE ON AuditEvent
        FOR EACH ROW
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'AuditEvent is append-only; UPDATE is forbidden'
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER AuditEvent_no_delete
        BEFORE DELETE ON AuditEvent
        FOR EACH ROW
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'AuditEvent is append-only; DELETE is forbidden'
    `);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("1295") || msg.includes("prepared statement")) {
      console.warn(
        "[globalSetup] Skipping AuditEvent triggers (MySQL DDL not supported via prepared statements).",
      );
      return;
    }
    throw error;
  }
}

async function dropAllTables(prisma: PrismaClient) {
  const tables = await prisma.$queryRaw<{ TABLE_NAME: string }[]>`
    SELECT TABLE_NAME FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_TYPE = 'BASE TABLE'`;
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
  for (const { TABLE_NAME } of tables) {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS \`${TABLE_NAME}\``);
  }
  // Drop append-only triggers if left behind without table recreate yet.
  await prisma.$executeRawUnsafe("DROP TRIGGER IF EXISTS `AuditEvent_no_update`").catch(() => undefined);
  await prisma.$executeRawUnsafe("DROP TRIGGER IF EXISTS `AuditEvent_no_delete`").catch(() => undefined);
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
}
