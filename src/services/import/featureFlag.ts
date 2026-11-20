import { prisma } from "@/lib/prisma";

/** Feature flag inventory_import — default ON when unset so seed/demo works. */
export async function isInventoryImportEnabled(tenantId: string): Promise<boolean> {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId },
    select: { featureFlags: true },
  });
  const flags = (tenant?.featureFlags || {}) as Record<string, unknown>;
  if (flags.inventory_import === false) {
    const { unprocessable } = await import("@/lib/errors");
    throw unprocessable("Inventory import is disabled for this tenant");
  }
  return true;
}

export function inventoryImportFlagOn(featureFlags: unknown): boolean {
  const flags = (featureFlags || {}) as Record<string, unknown>;
  return flags.inventory_import !== false;
}
