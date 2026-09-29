import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { bindTenantBypass, runWithTenantAsync } from "@/lib/auth/tenantStore";
import { prisma } from "@/lib/prisma";
import { withTenantGuard } from "@/lib/prisma/tenantExtension";

describe("SEC-01 tenant prisma guard", () => {
  afterAll(() => {
    bindTenantBypass();
  });

  it("throws when querying a tenant-scoped model with no ALS context", async () => {
    const raw = new PrismaClient();
    const guarded = withTenantGuard(raw);
    const prev = process.env.NODE_ENV;
    Object.assign(process.env, { NODE_ENV: "production" });
    try {
      await expect(guarded.attachment.findMany()).rejects.toThrow(/SEC-01|tenant context/i);
    } finally {
      Object.assign(process.env, { NODE_ENV: prev });
      await raw.$disconnect();
    }
  });

  it("scopes Attachment reads to the bound tenant", async () => {
    const own = await runWithTenantAsync("demo-tenant", async () => {
      return prisma.attachment.findMany({ take: 5 });
    });
    expect(own.every((a) => a.tenantId === "demo-tenant")).toBe(true);

    const other = await runWithTenantAsync("tenant-that-does-not-exist", async () => {
      return prisma.attachment.findMany({ take: 5 });
    });
    expect(other).toEqual([]);
  });
});
