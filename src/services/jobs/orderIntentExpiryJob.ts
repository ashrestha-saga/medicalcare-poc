import { prisma } from "@/lib/prisma";

const INTENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Expire shop intents older than 7 days without submit. */
export async function runOrderIntentExpiryJob(): Promise<{ expired: number }> {
  const cutoff = new Date(Date.now() - INTENT_TTL_MS);
  const result = await prisma.orderRequest.updateMany({
    where: {
      externalState: "intent",
      createdAt: { lt: cutoff },
    },
    data: { externalState: "expired" },
  });
  return { expired: result.count };
}
