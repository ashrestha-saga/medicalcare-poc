import { execSync } from "node:child_process";
import { copyFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { seed } from "../prisma/seed";

/**
 * Prepares prisma/test.db once per run: fresh schema + deterministic seed.
 * Prefers copying the migrated dev.db (no Prisma CLI needed); falls back to
 * `prisma db push` on a clean checkout. Seeding runs in-process.
 */
export default async function globalSetup() {
  const root = path.resolve(__dirname, "..");
  const devDb = path.join(root, "prisma", "dev.db");
  const testDb = path.join(root, "prisma", "test.db");
  for (const f of [testDb, `${testDb}-journal`]) if (existsSync(f)) rmSync(f);

  process.env.DATABASE_URL = "file:./test.db";
  if (existsSync(devDb)) {
    copyFileSync(devDb, testDb);
  } else {
    execSync("npx prisma db push --skip-generate --accept-data-loss", { cwd: root, env: { ...process.env }, stdio: "pipe" });
  }

  const prisma = new PrismaClient({ datasourceUrl: `file:${testDb}` });
  try {
    await truncateAll(prisma); // dev.db carries whatever manual testing left behind
    await seed(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

async function truncateAll(prisma: PrismaClient) {
  const tables = await prisma.$queryRaw<{ name: string }[]>`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys = OFF");
  for (const { name } of tables) await prisma.$executeRawUnsafe(`DELETE FROM "${name}"`);
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON");
}
