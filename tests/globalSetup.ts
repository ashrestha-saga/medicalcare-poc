import { execSync } from "node:child_process";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { seed } from "../prisma/seed";

/**
 * Prepares the MySQL test database once per run: schema push + truncate + seed.
 * Uses TEST_DATABASE_URL when set; otherwise DATABASE_URL from .env.
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

  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: root,
    env: { ...process.env },
    stdio: "pipe",
  });

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    await truncateAll(prisma);
    await seed(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

async function truncateAll(prisma: PrismaClient) {
  const tables = await prisma.$queryRaw<{ TABLE_NAME: string }[]>`
    SELECT TABLE_NAME FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_TYPE = 'BASE TABLE'
      AND TABLE_NAME <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
  for (const { TABLE_NAME } of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${TABLE_NAME}\``);
  }
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
}
