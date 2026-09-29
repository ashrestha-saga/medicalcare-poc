import { describe, expect, it } from "vitest";
import { actorFromPartnerOnTenant, actorFromTenant, actorSystem } from "@/lib/auth/actorContext";
import type { PartnerContext, TenantContext } from "@/interfaces/session";
import { changedFields, sanitizeAuditValue } from "./auditService";

const clinicCtx: TenantContext = {
  tenantId: "demo-tenant",
  user: {
    id: "user-1",
    name: "Ada Admin",
    accountKind: "clinic",
    role: "superadmin",
    tenantId: "demo-tenant",
  },
  correlationId: "corr-1",
  requestMeta: { ip: "10.0.0.2", userAgent: "vitest" },
};

const partnerCtx: PartnerContext = {
  organisationId: "org-msr",
  user: {
    id: "partner-1",
    name: "Max Partner",
    accountKind: "partner",
    organisationId: "org-msr",
    organisationName: "MSR",
    appRole: "inspector",
  },
  correlationId: "corr-p",
};

describe("audit sanitization", () => {
  it("redacts secrets and password fields", () => {
    const cleaned = sanitizeAuditValue({
      email: "a@demo.local",
      password: "secret",
      passwordHash: "hash",
      totpSecretEnc: "enc",
      accessToken: "tok",
      accessTokenEnc: "tok-enc",
      nested: { refreshToken: "r", refreshTokenEnc: "r-enc", name: "ok" },
    }) as Record<string, unknown>;
    expect(cleaned.email).toBe("a@demo.local");
    expect(cleaned.password).toBe("[REDACTED]");
    expect(cleaned.passwordHash).toBe("[REDACTED]");
    expect(cleaned.totpSecretEnc).toBe("[REDACTED]");
    expect(cleaned.accessToken).toBe("[REDACTED]");
    expect(cleaned.accessTokenEnc).toBe("[REDACTED]");
    expect((cleaned.nested as Record<string, unknown>).refreshToken).toBe("[REDACTED]");
    expect((cleaned.nested as Record<string, unknown>).refreshTokenEnc).toBe("[REDACTED]");
    expect((cleaned.nested as Record<string, unknown>).name).toBe("ok");
  });

  it("returns only changed fields", () => {
    const diff = changedFields(
      { areaId: "a1", room: "4", state: "draft" },
      { areaId: "a2", room: "4", state: "draft" },
    );
    expect(diff).toEqual({
      before: { areaId: "a1" },
      after: { areaId: "a2" },
    });
    expect(changedFields({ a: 1 }, { a: 1 })).toBeNull();
  });
});

describe("actor builders", () => {
  it("snapshots clinic session", () => {
    const actor = actorFromTenant(clinicCtx);
    expect(actor).toMatchObject({
      tenantId: "demo-tenant",
      actorUserId: "user-1",
      actorKind: "clinic",
      actorRole: "superadmin",
      actorName: "Ada Admin",
      organisationId: null,
      ip: "10.0.0.2",
    });
  });

  it("snapshots partner acting on a clinic tenant", () => {
    const actor = actorFromPartnerOnTenant(partnerCtx, "demo-tenant", "contract-1");
    expect(actor).toMatchObject({
      tenantId: "demo-tenant",
      actorUserId: "partner-1",
      actorKind: "partner",
      actorRole: "inspector",
      organisationId: "org-msr",
      organisationName: "MSR",
      serviceContractId: "contract-1",
    });
  });

  it("builds a system actor for webhooks", () => {
    const actor = actorSystem({ tenantId: "demo-tenant", source: "oxid" });
    expect(actor.actorKind).toBe("system");
    expect(actor.actorUserId).toBeNull();
    expect(actor.actorName).toBe("oxid");
  });
});
