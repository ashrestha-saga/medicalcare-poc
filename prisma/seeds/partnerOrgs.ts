/**
 * Partner organisations and the clinic contract from devicecare-testdaten.sql.
 * Institution rows (KLN, PRX, MVZ, ZAH) are kept as organisations; they are not
 * clinics. All four handover tenants are already folded into demo-tenant, so
 * only one ServiceContract can exist per partner (MSR → demo-tenant). That row
 * is the Klinikum Nord contract. The Praxis, MVZ, and Zahnzentrum contracts
 * described the same provider against other tenants and are not inserted.
 *
 * Partner users have accountKind=partner, no clinic tenantId/role, and an
 * OrgMembership. Password for all seeded partners is "demo".
 */
import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "../../src/lib/password";

const ORGANISATIONS = [
  {
    id: "1f0f2544-0dc8-5869-9c13-85f741e48258",
    code: "MSR",
    name: "Medtech Service Rhein GmbH",
    contact: "betrieb@msr.example",
    activeFrom: new Date("2020-01-01T00:00:00.000Z"),
  },
  {
    id: "7a48a751-3e3a-5edb-abfa-95ef550e6249",
    code: "RTS",
    name: "Radiotec Service GmbH",
    contact: "service@radiotec.example",
    activeFrom: new Date("2020-01-01T00:00:00.000Z"),
  },
  {
    id: "5c7c8e35-11ff-58f7-814f-bc94c9481bd1",
    code: "KLN",
    name: "Klinikum Nord gGmbH",
    contact: "medizintechnik@klinikum-nord.example",
    activeFrom: new Date("2020-01-01T00:00:00.000Z"),
  },
  {
    id: "0830a493-a1ba-5a5e-aa82-16ce74b894ee",
    code: "PRX",
    name: "Praxis Dr. Vogt",
    contact: "praxis@dr-vogt.example",
    activeFrom: new Date("2020-01-01T00:00:00.000Z"),
  },
  {
    id: "3fbe41da-61c9-5a20-a01d-c12631739a1a",
    code: "MVZ",
    name: "MVZ Rheinbogen GmbH",
    contact: "verwaltung@mvz-rheinbogen.example",
    activeFrom: new Date("2020-01-01T00:00:00.000Z"),
  },
  {
    id: "4521dff7-03c1-5815-98c4-2d8eb624838b",
    code: "ZAH",
    name: "Zahnzentrum Ville",
    contact: "info@zahnzentrum-ville.example",
    activeFrom: new Date("2020-01-01T00:00:00.000Z"),
  },
] as const;

/** Klinikum Nord contract: bestand / fristen / pruefung, still open. */
const MSR_ID = "1f0f2544-0dc8-5869-9c13-85f741e48258";
const RTS_ID = "7a48a751-3e3a-5edb-abfa-95ef550e6249";
const KLN_CONTRACT_ID = "d6223305-9759-5d99-bac4-670ea0292f2f";

/** Testdaten memberships with login subject — mapped to partner User + OrgMembership. */
const PARTNER_USERS = [
  {
    userId: "user-partner-msr-adler",
    membershipId: "0e4db61a-2fec-5609-93e3-98e36a9347eb",
    organisationId: MSR_ID,
    email: "k.adler@msr.example",
    name: "K. Adler",
    jobTitle: "Betriebsleitung",
    appRole: "admin",
    validFrom: new Date("2021-01-01T00:00:00.000Z"),
  },
  {
    userId: "user-partner-msr-reinhardt",
    membershipId: "c3801898-f975-5a60-b87c-c34e48a6e50c",
    organisationId: MSR_ID,
    email: "j.reinhardt@msr.example",
    name: "J. Reinhardt",
    jobTitle: "Medizintechnik",
    appRole: "inspector",
    validFrom: new Date("2021-01-01T00:00:00.000Z"),
  },
  {
    userId: "user-partner-rts-kaya",
    membershipId: "737dc847-c971-577d-8fc0-64a7f9eaf4dd",
    organisationId: RTS_ID,
    email: "m.kaya@rts.example",
    name: "Dr. M. Kaya",
    jobTitle: "Sachverständiger",
    appRole: "inspector",
    validFrom: new Date("2021-01-01T00:00:00.000Z"),
  },
] as const;

export async function seedPartnerOrgs(
  prisma: PrismaClient,
  tenantId: string,
): Promise<{ organisations: number; serviceContracts: number; partnerUsers: number; memberships: number }> {
  for (const org of ORGANISATIONS) {
    await prisma.organisation.upsert({
      where: { id: org.id },
      update: {
        code: org.code,
        name: org.name,
        contact: org.contact,
        activeFrom: org.activeFrom,
      },
      create: {
        id: org.id,
        code: org.code,
        name: org.name,
        contact: org.contact,
        activeFrom: org.activeFrom,
      },
    });
  }

  const scope = JSON.stringify(["inventory", "due-dates", "inspection"]);
  const validFrom = new Date("2024-01-01T00:00:00.000Z");

  await prisma.serviceContract.upsert({
    where: { tenantId_organisationId: { tenantId, organisationId: MSR_ID } },
    update: {
      validFrom,
      validTo: null,
      scope,
    },
    create: {
      id: KLN_CONTRACT_ID,
      tenantId,
      organisationId: MSR_ID,
      validFrom,
      validTo: null,
      scope,
    },
  });

  const demoHash = hashPassword("demo");
  for (const p of PARTNER_USERS) {
    await prisma.user.upsert({
      where: { id: p.userId },
      update: {
        email: p.email,
        name: p.name,
        jobTitle: p.jobTitle,
        accountKind: "partner",
        tenantId: null,
        role: null,
        passwordHash: demoHash,
        active: true,
      },
      create: {
        id: p.userId,
        email: p.email,
        name: p.name,
        jobTitle: p.jobTitle,
        accountKind: "partner",
        tenantId: null,
        role: null,
        passwordHash: demoHash,
        active: true,
      },
    });

    await prisma.orgMembership.upsert({
      where: { id: p.membershipId },
      update: {
        userId: p.userId,
        organisationId: p.organisationId,
        appRole: p.appRole,
        validFrom: p.validFrom,
        validTo: null,
      },
      create: {
        id: p.membershipId,
        userId: p.userId,
        organisationId: p.organisationId,
        appRole: p.appRole,
        validFrom: p.validFrom,
        validTo: null,
      },
    });
  }

  return {
    organisations: ORGANISATIONS.length,
    serviceContracts: 1,
    partnerUsers: PARTNER_USERS.length,
    memberships: PARTNER_USERS.length,
  };
}
