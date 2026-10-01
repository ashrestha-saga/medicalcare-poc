import { afterAll, describe, expect, it } from "vitest";
import type { PartnerContext } from "@/interfaces/session";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { clinicOnboardService } from "@/services/console/clinicOnboardService";
import { createClinicSchema } from "@/schemas/console";

const MSR_ID = "1f0f2544-0dc8-5869-9c13-85f741e48258";
const RTS_ID = "7a48a751-3e3a-5edb-abfa-95ef550e6249";

const adminCtx: PartnerContext = {
  organisationId: MSR_ID,
  user: {
    id: "user-partner-msr-adler",
    name: "K. Adler",
    accountKind: "partner",
    organisationId: MSR_ID,
    organisationName: "Medtech Service Rhein GmbH",
    appRole: "admin",
  },
  correlationId: "clinic-onboard",
};

const msrInspectorCtx: PartnerContext = {
  organisationId: MSR_ID,
  user: {
    id: "user-partner-msr-reinhardt",
    name: "J. Reinhardt",
    accountKind: "partner",
    organisationId: MSR_ID,
    organisationName: "Medtech Service Rhein GmbH",
    appRole: "inspector",
  },
  correlationId: "clinic-onboard-msr-insp",
};

const rtsAdminCtx: PartnerContext = {
  organisationId: RTS_ID,
  user: {
    id: "user-partner-rts-kaya",
    name: "Dr. M. Kaya",
    accountKind: "partner",
    organisationId: RTS_ID,
    organisationName: "Radiotec Service GmbH",
    appRole: "admin",
  },
  correlationId: "clinic-onboard-rts",
};

const createdTenantIds: string[] = [];

afterAll(async () => {
  for (const tenantId of createdTenantIds) {
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { institutionOrgId: true },
    });
    await prisma.userInvitation.deleteMany({ where: { tenantId } });
    await prisma.auditEvent.deleteMany({ where: { tenantId } });
    await prisma.serviceContract.deleteMany({ where: { tenantId } });
    await prisma.site.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => undefined);
    if (tenant?.institutionOrgId) {
      await prisma.organisationRole.deleteMany({ where: { organisationId: tenant.institutionOrgId } });
      await prisma.organisation.delete({ where: { id: tenant.institutionOrgId } }).catch(() => undefined);
    }
  }
  await prisma.$disconnect();
});

describe("clinicOnboardService", () => {
  it("lists the seeded MSR contract as live", async () => {
    const list = await clinicOnboardService.list(adminCtx);
    expect(list.canCreate).toBe(true);
    expect(list.clinics.some((c) => c.live && c.tenantId === "demo-tenant")).toBe(true);
  });

  it("creates institution, tenant, site and contract in one step", async () => {
    const suffix = Date.now().toString(36).slice(-4).toUpperCase();
    const tenantCode = `T-Z${suffix}`.slice(0, 14);
    const input = createClinicSchema.parse({
      name: `Praxis ${suffix}`,
      street: "Hauptstr. 1",
      postalCode: "53111",
      city: "Bonn",
      country: "DE",
      tenantCode,
      siteName: "Hauptstandort",
      contactName: "Dr. Kontakt",
      contactEmail: `kontakt-${suffix.toLowerCase()}@praxis-test.example`,
      validFrom: "2026-10-01",
      billingRef: "KTO-TEST",
      avvRef: "AVV-TEST",
      operatingModel: "provider_operated",
      scope: ["inventory", "inspection"],
    });
    const { clinic, invite } = await clinicOnboardService.create(adminCtx, input);
    createdTenantIds.push(clinic.tenantId);
    expect(clinic.tenantCode).toBe(tenantCode);
    expect(clinic.live).toBe(true);
    expect(clinic.city).toBe("Bonn");
    expect(clinic.siteCount).toBe(1);
    expect(clinic.scope).toEqual(["inventory", "inspection"]);
    expect(invite.email).toBe(input.contactEmail);
    expect(invite.redeemUrl).toContain("/invite?token=");

    const tenant = await prisma.tenant.findFirst({ where: { code: tenantCode } });
    expect(tenant?.operatingModel).toBe("provider_operated");
    expect(tenant?.institutionOrgId).toBeTruthy();
    const site = await prisma.site.findFirst({ where: { tenantId: tenant!.id } });
    expect(site?.city).toBe("Bonn");
    expect(site?.postalCode).toBe("53111");
    expect(site?.street).toBe("Hauptstr. 1");
    expect(site?.address).toContain("Bonn");
    const contract = await prisma.serviceContract.findFirst({
      where: { tenantId: tenant!.id, organisationId: MSR_ID },
    });
    expect(contract?.billingRef).toBe("KTO-TEST");
    const invitation = await prisma.userInvitation.findFirst({
      where: { tenantId: tenant!.id, email: input.contactEmail },
    });
    expect(invitation?.role).toBe("superadmin");
    expect(invitation?.name).toBe("Dr. Kontakt");
    const audit = await prisma.auditEvent.findFirst({
      where: { tenantId: tenant!.id, resource: "tenant", action: "create" },
    });
    expect(audit?.actorKind).toBe("partner");
    expect(audit?.organisationId).toBe(MSR_ID);
  });

  it("refuses a partner who is not an organisation admin", async () => {
    const input = createClinicSchema.parse({
      name: "No",
      postalCode: "12345",
      city: "X",
      tenantCode: "T-NOPE99",
      siteName: "S",
      contactEmail: "nope99@example.com",
      validFrom: "2026-10-01",
      avvRef: "AVV-X",
      operatingModel: "provider_operated",
      scope: ["inventory"],
    });
    await expect(clinicOnboardService.create(msrInspectorCtx, input)).rejects.toBeInstanceOf(AppError);
    await expect(clinicOnboardService.create(msrInspectorCtx, input)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("refuses an organisation without service_provider capacity", async () => {
    const input = createClinicSchema.parse({
      name: "No",
      postalCode: "12345",
      city: "X",
      tenantCode: "T-NOPE98",
      siteName: "S",
      contactEmail: "nope98@example.com",
      validFrom: "2026-10-01",
      avvRef: "AVV-X",
      operatingModel: "provider_operated",
      scope: ["inventory"],
    });
    await expect(clinicOnboardService.create(rtsAdminCtx, input)).rejects.toMatchObject({ status: 403 });
  });
});
