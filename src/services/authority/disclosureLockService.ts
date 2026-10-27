import { locked } from "@/lib/errors";
import { isDisclosureWriteBypass } from "@/lib/auth/disclosureWriteBypass";
import { prisma } from "@/lib/prisma";

export type OpenDisclosureLock = {
  id: string;
  expiresAt: Date;
};

/**
 * Active open session for a tenant, or null. Lazily auto-closes expired rows (R3).
 */
export async function getActiveDisclosureSession(
  tenantId: string,
): Promise<OpenDisclosureLock | null> {
  const now = new Date();
  const row = await prisma.disclosureSession.findFirst({
    where: { tenantId, closedAt: null },
    orderBy: { openedAt: "desc" },
    select: { id: true, expiresAt: true, closedAt: true, autoClosed: true },
  });
  if (!row) return null;
  if (row.expiresAt.getTime() <= now.getTime()) {
    // Lazy expiry — must bypass write lock to update the session itself.
    const { runWithDisclosureWriteBypass } = await import("@/lib/auth/disclosureWriteBypass");
    await runWithDisclosureWriteBypass(async () => {
      await prisma.disclosureSession.updateMany({
        where: { id: row.id, closedAt: null },
        data: { closedAt: row.expiresAt, autoClosed: true },
      });
    });
    return null;
  }
  return { id: row.id, expiresAt: row.expiresAt };
}

/** R2 — throw 423 unless bypass (session close / readiness / disclosed). */
export async function assertClinicWritable(tenantId: string): Promise<void> {
  if (isDisclosureWriteBypass()) return;
  const open = await getActiveDisclosureSession(tenantId);
  if (!open) return;
  throw locked("Während der Sitzung wird nur gezeigt", {
    code: "DISCLOSURE_SESSION_ACTIVE",
    sessionId: open.id,
    expiresAt: open.expiresAt.toISOString(),
  });
}
