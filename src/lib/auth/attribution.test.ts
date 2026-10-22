import { describe, expect, it } from "vitest";
import {
  actorAttribution,
  performedByAttribution,
  recordedByAttribution,
} from "@/lib/auth/attribution";
import type { TenantWorkContext } from "@/interfaces";

function ctx(name: string, id = "user-1"): TenantWorkContext {
  return {
    tenantId: "demo-tenant",
    correlationId: "c1",
    user: {
      id,
      name,
      email: "a@demo.local",
      role: "device_admin",
      accountKind: "clinic",
      tenantId: "demo-tenant",
    },
  } as TenantWorkContext;
}

describe("attribution helpers", () => {
  it("freezes name + user id for actor / recorded / performed", () => {
    const c = ctx("Anna Technik", "user-tech-1");
    expect(actorAttribution(c)).toEqual({ userId: "user-tech-1", name: "Anna Technik" });
    expect(recordedByAttribution(c)).toEqual({
      recordedBy: "Anna Technik",
      recordedByUserId: "user-tech-1",
    });
    expect(performedByAttribution(c)).toEqual({
      performedBy: "Anna Technik",
      performedByUserId: "user-tech-1",
    });
  });

  it("falls back to user id when name is blank", () => {
    expect(actorAttribution(ctx("  ", "u9")).name).toBe("u9");
  });
});
