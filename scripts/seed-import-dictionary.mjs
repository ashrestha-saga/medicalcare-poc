import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();
const path = join(process.cwd(), "fixtures/import/synonyme.json");
const content = JSON.parse(readFileSync(path, "utf8"));
const version = typeof content.version === "string" ? content.version : "v1 (04.11.2026)";

await prisma.refImportDictionary.upsert({
  where: { template_version: { template: "excel_14", version } },
  update: { content, active: true },
  create: { template: "excel_14", version, content, active: true },
});
console.log("RefImportDictionary seeded", version);
await prisma.$disconnect();
