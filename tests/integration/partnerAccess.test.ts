import { afterAll, describe, expect, it, vi } from "vitest";
import type { ActingContext, PartnerContext, TenantContext } from "@/interfaces/session";
import { partnerActingPermissions } from "@/constants/partnerPermissions";
import { AppError } from "@/lib/errors";
import { actorFromPartnerOnTenant } from "@/lib/auth/actorContext";
import { prisma } from "@/lib/prisma";
import { deviceInventoryService } from "@/services/inventory/deviceInventoryService";
import { partnerHomeService } from "@/services/partner/partnerHomeService";
import { assertPartnerManagesTenant } from "@/services/access/partnerAccessService";
import { auditService } from "@/services/audit/auditService";
import { userAdminService } from "@/services/users/userAdminService";
import { trainingService } from "@/services/training/trainingService";

const MSR_ID = "1f0f2544-0dc8-5869-9c13-85f741e48258";
const RTS_ID = "7a48a751-3e3a-5edb-abfa-95ef550e6249";
const CONTRACT_ID = "d6223305-9759-5d99-bac4-670ea0292f2f";

const clinicAdmin: TenantContext = {
  tenantId: "demo-tenant",
  user: {
    id: "user-admin-1",
    name: "Admin Klinik",
    accountKind: "clinic",
    role: "superadmin",
    tenantId: "demo-tenant",
  },
  correlationId: "clinic-access",
};

const partnerCtx: PartnerContext = {
  organisationId: MSR_ID,
  user: {
    id: "user-partner-msr-adler",
    name: "K. Adler",
    accountKind: "partner",
    organisationId: MSR_ID,
    organisationName: "Medtech Service Rhein GmbH",
    appRole: "admin",
  },
  correlationId: "partner-access",
};

function partnerActing(tenantId = "demo-tenant"): ActingContext {
  const permissions = partnerActingPermissions("admin", ["inventory", "due-dates", "inspection"]);
  return {
    tenantId,
    user: partnerCtx.user,
    correlationId: partnerCtx.correlationId,
    permissions,
    actor: actorFromPartnerOnTenant(partnerCtx, tenantId, CONTRACT_ID),
  };
}

afterAll(async () => {
  await prisma.serviceContract.update({
    where: { id: CONTRACT_ID },
    data: { terminatedAt: null, suspendedAt: null, validTo: null },
  }).catch(() => undefined);
  await prisma.$disconnect();
});

describe("partner organisation access", () => {
  it("lets MSR admin manage demo-tenant via live contract + service_provider", async () => {
    const access = await assertPartnerManagesTenant(
      "user-partner-msr-adler",
      MSR_ID,
      "demo-tenant",
    );
    expect(access.contractId).toBe(CONTRACT_ID);
    expect(access.scope).toEqual(expect.arrayContaining(["inventory", "due-dates", "inspection"]));
    expect(access.appRole).toBe("admin");
  });

  it("refuses RTS inspector (no service_provider / no contract)", async () => {
    await expect(
      assertPartnerManagesTenant("user-partner-rts-kaya", RTS_ID, "demo-tenant"),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("refuses a foreign tenant id", async () => {
    await expect(
      assertPartnerManagesTenant("user-partner-msr-adler", MSR_ID, "no-such-tenant"),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("drops the clinic from partner home and denies manage when the contract is suspended", async () => {
    await prisma.serviceContract.update({
      where: { id: CONTRACT_ID },
      data: { suspendedAt: new Date() },
    });
    await expect(
      assertPartnerManagesTenant("user-partner-msr-adler", MSR_ID, "demo-tenant"),
    ).rejects.toMatchObject({ status: 403 });
    const home = await partnerHomeService.getHome(partnerCtx);
    expect(home.roles).toEqual(expect.arrayContaining(["service_provider", "inspection_partner"]));
    expect(home.clinics.map((c) => c.tenantId)).not.toContain("demo-tenant");

    await prisma.serviceContract.update({
      where: { id: CONTRACT_ID },
      data: { suspendedAt: null },
    });
    const restored = await partnerHomeService.getHome(partnerCtx);
    expect(restored.clinics.map((c) => c.tenantId)).toContain("demo-tenant");
  });

  it("records clinic inventory updates as actorKind=clinic", async () => {
    const device = await deviceInventoryService.get(clinicAdmin, "instance-inv-10001");
    await deviceInventoryService.update(clinicAdmin, device.id, {
      room: device.location?.room ?? "ICU",
    });
    const row = await prisma.auditEvent.findFirst({
      where: {
        tenantId: "demo-tenant",
        resource: "device",
        resourceId: device.id,
        actorUserId: "user-admin-1",
      },
      orderBy: { occurredAt: "desc" },
    });
    expect(row?.actorKind).toBe("clinic");
    expect(row?.organisationId).toBeNull();
  });

  it("records partner inventory updates with organisation + contract snapshot", async () => {
    const ctx = partnerActing();
    const device = await deviceInventoryService.get(ctx, "instance-inv-10001");
    const nextRoom = `P-${Date.now().toString().slice(-6)}`;
    await deviceInventoryService.update(ctx, device.id, { room: nextRoom });
    const row = await prisma.auditEvent.findFirst({
      where: {
        tenantId: "demo-tenant",
        resource: "device",
        resourceId: device.id,
        actorUserId: "user-partner-msr-adler",
      },
      orderBy: { occurredAt: "desc" },
    });
    expect(row?.actorKind).toBe("partner");
    expect(row?.organisationId).toBe(MSR_ID);
    expect(row?.serviceContractId).toBe(CONTRACT_ID);
    expect(row?.actorRole).toBe("admin");
  });

  it("blocks reserved user and training APIs for a partner acting context", async () => {
    const ctx = partnerActing();
    await expect(userAdminService.list(ctx as unknown as TenantContext)).rejects.toBeInstanceOf(AppError);
    await expect(userAdminService.list(ctx as unknown as TenantContext)).rejects.toMatchObject({ status: 403 });
    await expect(trainingService.getOverview(ctx as unknown as TenantContext)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("cannot list another tenant's audit by swapping tenantId on the query", async () => {
    const ctx = partnerActing("demo-tenant");
    await prisma.tenant.upsert({
      where: { id: "partner-other-tenant" },
      update: { name: "Other" },
      create: { id: "partner-other-tenant", name: "Other" },
    });
    await prisma.auditEvent.create({
      data: {
        tenantId: "partner-other-tenant",
        actorKind: "clinic",
        actorName: "Hidden",
        resource: "device",
        resourceId: "hidden",
        action: "update",
        summary: "should not leak",
      },
    });
    const listed = await auditService.list(ctx, { q: "should not leak" });
    expect(listed.events).toEqual([]);
    await prisma.auditEvent.deleteMany({ where: { tenantId: "partner-other-tenant" } });
    await prisma.tenant.delete({ where: { id: "partner-other-tenant" } });
  });
});

describe("requireActingContext header gate", () => {
  it("forbids a partner without X-Acting-Tenant-Id", async () => {
    vi.resetModules();
    vi.doMock("@/lib/auth/session", () => ({
      readSession: vi.fn().mockResolvedValue(partnerCtx.user),
    }));
    const { requireActingContext } = await import("@/lib/auth/tenantContext");
    await expect(requireActingContext(new Request("http://localhost/api/devices"))).rejects.toMatchObject({
      status: 403,
    });
    vi.doUnmock("@/lib/auth/session");
    vi.resetModules();
  });
});
