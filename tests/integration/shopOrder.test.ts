import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import type { TenantWorkContext } from "@/interfaces";
import { AppError } from "@/lib/errors";
import { encryptSecret } from "@/lib/crypto/secretBox";
import { prisma } from "@/lib/prisma";
import { shopOrderService } from "@/services/shop/shopOrderService";

const tenantId = "demo-tenant";
const ctx: TenantWorkContext = {
  tenantId,
  user: {
    id: "user-tech-1",
    name: "Anna Technik",
    accountKind: "clinic",
    role: "device_admin",
    tenantId,
  },
  correlationId: "shop-order-test",
};

let previousFlags: unknown;
let hadConnection = false;

beforeAll(async () => {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  previousFlags = tenant?.featureFlags ?? null;
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { featureFlags: { ordering: true } },
  });

  const existing = await prisma.tenantShopConnection.findUnique({ where: { tenantId } });
  hadConnection = Boolean(existing);
  await prisma.tenantShopConnection.upsert({
    where: { tenantId },
    create: {
      tenantId,
      provider: "mock",
      shopBaseUrl: "https://shop.example.com",
      clientId: "mock-client",
      clientSecretEnc: encryptSecret("mock-secret"),
      scope: "api",
      status: "connected",
      accessTokenEnc: encryptSecret("mock-access-integration"),
      expiresAt: new Date(Date.now() + 3600_000),
      hasSubUsers: true,
      connectedAt: new Date(),
      connectedByUserId: "user-admin-1",
    },
    update: {
      provider: "mock",
      shopBaseUrl: "https://shop.example.com",
      clientId: "mock-client",
      clientSecretEnc: encryptSecret("mock-secret"),
      status: "connected",
      accessTokenEnc: encryptSecret("mock-access-integration"),
      expiresAt: new Date(Date.now() + 3600_000),
      hasSubUsers: true,
      submitLeaseUntil: null,
      submitLeaseBy: null,
    },
  });
});

afterAll(async () => {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      featureFlags:
        previousFlags === null || previousFlags === undefined
          ? Prisma.DbNull
          : (previousFlags as Prisma.InputJsonValue),
    },
  }).catch(() => undefined);
  if (!hadConnection) {
    await prisma.tenantShopConnection.deleteMany({ where: { tenantId, provider: "mock" } }).catch(() => undefined);
  }
  await prisma.$disconnect();
});

describe("shop order pipeline (mock provider)", () => {
  it("intent → PIN → ordered", async () => {
    const key = `shop-ok-${Date.now()}`;
    const created = await shopOrderService.createIntent(
      {
        idempotencyKey: key,
        deliveryAddress: "Warehouse Bonn",
        raisedBy: "Anna Technik",
        purpose: "parts",
        items: [{ articleNumber: "ACC-SET-01", description: "Infusion set", quantity: 2 }],
      },
      ctx,
    );
    expect(created.order.externalState).toBe("intent");

    const submitted = await shopOrderService.submit(
      created.order.reference,
      { pin: "1234" },
      ctx,
    );
    expect(submitted.order.externalState).toBe("ordered");
    expect(submitted.order.externalOrderRef).toMatch(/^MS-/);
    expect(submitted.order.orderedByName).toContain("Ray");
  });

  it("rejects wrong PIN", async () => {
    const key = `shop-pin-${Date.now()}`;
    const created = await shopOrderService.createIntent(
      {
        idempotencyKey: key,
        deliveryAddress: "Warehouse Bonn",
        raisedBy: "Anna Technik",
        items: [{ articleNumber: "ACC-SET-01", description: "Infusion set", quantity: 1 }],
      },
      ctx,
    );
    await expect(shopOrderService.submit(created.order.reference, { pin: "9999" }, ctx)).rejects.toMatchObject({
      code: "PIN_INVALID",
      status: 422,
    } satisfies Partial<AppError>);
  });

  it("reuses submitKey on retry after submitting", async () => {
    const key = `shop-retry-${Date.now()}`;
    const created = await shopOrderService.createIntent(
      {
        idempotencyKey: key,
        deliveryAddress: "Warehouse Bonn",
        raisedBy: "Anna Technik",
        items: [{ articleNumber: "ACC-FILTER-02", description: "Filter", quantity: 1 }],
      },
      ctx,
    );
    const first = await shopOrderService.submit(created.order.reference, { pin: "1234" }, ctx);
    const again = await shopOrderService.submit(created.order.reference, { pin: "1234" }, ctx);
    expect(again.order.externalOrderRef).toBe(first.order.externalOrderRef);
  });

  it("feature flag off → 403", async () => {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { featureFlags: { ordering: false } },
    });
    await expect(
      shopOrderService.createIntent(
        {
          idempotencyKey: `shop-flag-${Date.now()}`,
          deliveryAddress: "Warehouse Bonn",
          raisedBy: "Anna Technik",
          items: [{ articleNumber: "ACC-SET-01", description: "Infusion set", quantity: 1 }],
        },
        ctx,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { featureFlags: { ordering: true } },
    });
  });
});
