import type { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** SHA-256 of public/import/devicecare-vorlage-bestandsverzeichnis.xlsx (A34). */
export const IMPORT_TEMPLATE_SHA256 =
  "6cd325d3fe17975c6637d40f2da469ad22e73c0511ecc3639e05effd08d58f60";

export async function seedImportDictionary(prisma: PrismaClient) {
  const path = join(process.cwd(), "fixtures/import/synonyme.json");
  const content = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const version =
    typeof content.version === "string" ? content.version : "v1 (04.11.2026)";

  await prisma.refImportDictionary.upsert({
    where: { template_version: { template: "excel_14", version } },
    update: { content, active: true },
    create: {
      template: "excel_14",
      version,
      content,
      active: true,
    },
  });

  // Deactivate any other excel_14 versions
  await prisma.refImportDictionary.updateMany({
    where: { template: "excel_14", version: { not: version } },
    data: { active: false },
  });
}
