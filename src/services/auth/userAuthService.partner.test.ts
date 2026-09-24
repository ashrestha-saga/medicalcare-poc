import { describe, expect, it, vi, beforeEach } from "vitest";
import { decodeSessionToken, buildSessionToken } from "@/lib/auth/sessionToken";
import { isClinicSession, isPartnerSession, type SessionUser } from "@/interfaces/session";

vi.mock("@/lib/prisma", () => {
  const user = {
    findFirst: vi.fn(),
  };
  const orgMembership = {
    findFirst: vi.fn(),
  };
  return {
    prisma: { user, orgMembership },
  };
});

vi.mock("@/lib/password", () => ({
  verifyPassword: vi.fn((pw: string, hash: string) => pw === "demo" && hash === "hash"),
}));

import { prisma } from "@/lib/prisma";
import { userAuthService } from "@/services/auth/userAuthService";

const mockedUser = prisma.user.findFirst as unknown as ReturnType<typeof vi.fn>;
const mockedMembership = prisma.orgMembership.findFirst as unknown as ReturnType<typeof vi.fn>;

describe("partner session helpers", () => {
  it("round-trips partner session tokens without clinic tenantId", () => {
    const user: SessionUser = {
      id: "user-partner-msr-adler",
      name: "K. Adler",
      accountKind: "partner",
      organisationId: "org-msr",
      organisationName: "Medtech Service Rhein GmbH",
      appRole: "admin",
      companyName: "Medtech Service Rhein GmbH",
    };
    const token = buildSessionToken(user, "test-secret");
    const payload = decodeSessionToken(token, "test-secret");
    expect(payload?.user.accountKind).toBe("partner");
    expect(payload?.user.organisationId).toBe("org-msr");
    expect(isPartnerSession(payload?.user)).toBe(true);
    expect(isClinicSession(payload?.user)).toBe(false);
  });

  it("still accepts clinic tokens (and back-compat without accountKind)", () => {
    const legacy = {
      id: "u1",
      name: "Anna",
      role: "device_admin" as const,
      tenantId: "demo-tenant",
    };
    const token = buildSessionToken(legacy as SessionUser, "test-secret");
    const payload = decodeSessionToken(token, "test-secret");
    expect(payload?.user.accountKind).toBe("clinic");
    expect(payload?.user.tenantId).toBe("demo-tenant");
  });
});

describe("userAuthService partner door", () => {
  beforeEach(() => {
    mockedUser.mockReset();
    mockedMembership.mockReset();
  });

  it("authenticates an active partner with membership", async () => {
    mockedUser.mockResolvedValue({
      id: "user-partner-msr-adler",
      name: "K. Adler",
      email: "k.adler@msr.example",
      passwordHash: "hash",
      active: true,
      accountKind: "partner",
    });
    mockedMembership.mockResolvedValue({
      appRole: "admin",
      organisation: { id: "org-msr", name: "Medtech Service Rhein GmbH" },
    });

    const result = await userAuthService.authenticatePartner("k.adler@msr.example", "demo");
    expect(result.user.accountKind).toBe("partner");
    expect(result.user.organisationId).toBe("org-msr");
    expect(result.organisationName).toBe("Medtech Service Rhein GmbH");
  });

  it("rejects clinic credentials on the partner door", async () => {
    mockedUser.mockResolvedValue(null);
    await expect(userAuthService.authenticatePartner("anna@demo.local", "demo")).rejects.toMatchObject({
      status: 401,
    });
  });

  it("rejects partners without an active membership", async () => {
    mockedUser.mockResolvedValue({
      id: "user-partner-rts-kaya",
      name: "Dr. M. Kaya",
      passwordHash: "hash",
      active: true,
      accountKind: "partner",
    });
    mockedMembership.mockResolvedValue(null);
    await expect(userAuthService.authenticatePartner("m.kaya@rts.example", "demo")).rejects.toMatchObject({
      status: 401,
    });
  });
});
