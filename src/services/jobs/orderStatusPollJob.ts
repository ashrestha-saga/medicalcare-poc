import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { shopAuthService } from "@/services/shop/shopAuthService";
import { shopConnectionService } from "@/services/shop/shopConnectionService";
import { getShopProvider } from "@/services/shop/shopRegistry";

/** Poll shop order status for ordered rows (requires objects.orders.read). */
export async function runOrderStatusPollJob(): Promise<{ checked: number; updated: number }> {
  const rows = await prisma.orderRequest.findMany({
    where: {
      externalState: "ordered",
      externalOrderRef: { not: null },
    },
    take: 100,
    orderBy: { updatedAt: "asc" },
  });

  let updated = 0;
  const byTenant = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byTenant.get(row.tenantId) ?? [];
    list.push(row);
    byTenant.set(row.tenantId, list);
  }

  for (const [tenantId, orders] of byTenant) {
    const session = await shopAuthService.getSession(tenantId);
    if (!session) continue;
    const provider = getShopProvider(await shopConnectionService.getProviderType(tenantId));
    if (!provider.orders?.getStatus) continue;
    const refs = orders.map((o) => o.externalOrderRef!).filter(Boolean);
    try {
      const statuses = await provider.orders.getStatus(session, refs);
      for (const status of statuses) {
        const order = orders.find((o) => o.externalOrderRef === status.orderNumber);
        if (!order) continue;
        const next =
          /ship|deliver/i.test(status.state) ? "shipped" :
          /cancel/i.test(status.state) ? "cancelled" :
          null;
        if (!next || next === order.externalState) continue;
        await prisma.orderRequest.update({
          where: { id: order.id },
          data: { externalState: next },
        });
        await prisma.orderStatusEvent.create({
          data: {
            tenantId,
            orderRequestId: order.id,
            externalState: next,
            source: "poll",
            eventId: `poll:${status.orderNumber}:${next}:${Date.now()}`,
          },
        });
        updated += 1;
      }
    } catch (error) {
      logger.warn("shop.order_poll.failed", { tenantId, error: String(error) });
    }
  }

  return { checked: rows.length, updated };
}
