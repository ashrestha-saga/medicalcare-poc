import { PrismaClient } from "@prisma/client";
import { dutyService } from "../src/services/registration/dutyService";

const prisma = new PrismaClient();

async function main() {
  const cols = await prisma.$queryRawUnsafe<{ Field: string }[]>("SHOW COLUMNS FROM DeviceDuty");
  const names = cols.map((c) => c.Field);
  console.log("columns", names.join(", "));

  const needed = [
    ["lastCompletedAt", "DATETIME(3) NULL"],
    ["lastNotifiedAt", "DATETIME(3) NULL"],
    ["notifyStage", "VARCHAR(191) NULL"],
  ] as const;
  for (const [col, ddl] of needed) {
    if (!names.includes(col)) {
      await prisma.$executeRawUnsafe(`ALTER TABLE \`DeviceDuty\` ADD COLUMN \`${col}\` ${ddl}`);
      console.log("added column", col);
    }
  }

  const indexes = await prisma.$queryRawUnsafe<{ Key_name: string }[]>("SHOW INDEX FROM DeviceDuty");
  const indexNames = new Set(indexes.map((i) => i.Key_name));
  if (!indexNames.has("DeviceDuty_tenantId_suspendedAt_dueAt_idx")) {
    await prisma.$executeRawUnsafe(
      "CREATE INDEX `DeviceDuty_tenantId_suspendedAt_dueAt_idx` ON `DeviceDuty`(`tenantId`, `suspendedAt`, `dueAt`)",
    );
    console.log("added index DeviceDuty_tenantId_suspendedAt_dueAt_idx");
  }

  const n = await dutyService.backfillDueDates(prisma);
  console.log("backfilled", n);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
