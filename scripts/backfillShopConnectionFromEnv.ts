/**
 * One-shot: copy global OXID_* env into TenantShopConnection when a row exists
 * without client credentials (migration helper).
 *
 * Usage: npx tsx scripts/backfillShopConnectionFromEnv.ts
 */
import { PrismaClient } from "@prisma/client";
import { encryptSecret } from "../src/lib/crypto/secretBox";

const prisma = new PrismaClient();

async function main() {
  const clientId = process.env.OXID_CLIENT_ID?.trim();
  const clientSecret = process.env.OXID_CLIENT_SECRET?.trim();
  const shopBaseUrl = (process.env.OXID_API_BASE_URL || process.env.OXID_AUTHORIZE_URL || "")
    .replace(/\/oauth\/.*$/, "")
    .replace(/\/$/, "");
  const scope =
    process.env.OXID_SCOPE?.trim() ||
    "api objects.me.read objects.items.read objects.orders.write objects.orders.read objects.recommendations.read";

  if (!clientId || !clientSecret || !shopBaseUrl) {
    console.log("OXID_CLIENT_ID / OXID_CLIENT_SECRET / OXID_API_BASE_URL not set — nothing to backfill.");
    return;
  }

  const rows = await prisma.tenantShopConnection.findMany();
  let updated = 0;
  for (const row of rows) {
    if (row.clientId && row.clientSecretEnc) continue;
    await prisma.tenantShopConnection.update({
      where: { id: row.id },
      data: {
        shopBaseUrl: row.shopBaseUrl || shopBaseUrl,
        clientId: row.clientId || clientId,
        clientSecretEnc: row.clientSecretEnc || encryptSecret(clientSecret),
        scope: row.scope || scope,
      },
    });
    updated += 1;
  }
  console.log(`Backfilled shop credentials on ${updated} connection(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
