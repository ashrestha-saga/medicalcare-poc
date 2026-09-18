/**
 * Deterministic seed — Section 15.3.
 * Every id is fixed so unit/integration/e2e tests can reference them directly.
 * Running the seed repeatedly is safe: everything is upserted.
 */
import { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "node:url";
import { hashPassword } from "../src/lib/password";
import { seedRoleGrantsIfEmpty } from "../src/services/roles/roleGrantsService";

export const SEED = {
  tenantId: "demo-tenant",
  users: {
    anna: "user-tech-1",
    ben: "user-nurse-1",
    clara: "user-buyer-1",
    admin: "user-admin-1",
  },
  sites: {
    bonn: "site-bonn",
    cologne: "site-cologne",
  },
  areas: {
    bonnIcu: "area-bonn-icu",
    bonnRadiology: "area-bonn-radiology",
    cologneOr: "area-cologne-or",
  },
  models: {
    // stage 1 + verified rule (manufacturer+model)
    pumpX200: "model-pump-x200",
    // stage 2 catalog hit + derived rule (EMDN)
    monitorM10: "model-monitor-m10",
    // stage 2 catalog hit, no rule at all
    ventilatorV3: "model-ventilator-v3",
  },
  instances: {
    pump: "instance-inv-10001",
    monitor: "instance-inv-10002",
  },
  gtins: {
    pumpX200: "04012345678901",
    monitorM10: "04012345678918",
    ventilatorV3: "04012345678925",
  },
  rules: {
    pumpVerified: "rule-pump-x200-verified",
    monitorDerived: "rule-emdn-z12-derived",
  },
  dispatchTargets: {
    mail: "dispatch-mail-demo",
    oxid: "dispatch-oxid-demo",
  },
} as const;

export async function seed(prisma: PrismaClient) {
  const tenant = await prisma.tenant.upsert({
    where: { id: SEED.tenantId },
    update: { name: "Demo Clinic" },
    create: { id: SEED.tenantId, name: "Demo Clinic" },
  });

  const demoHash = hashPassword("demo");
  const users = [
    { id: SEED.users.anna, email: "anna@demo.local", name: "Anna Technik", role: "device_admin" },
    { id: SEED.users.ben, email: "ben@demo.local", name: "Ben Pflege", role: "user" },
    { id: SEED.users.clara, email: "clara@demo.local", name: "Clara Sicherheit", role: "security_officer" },
    { id: SEED.users.admin, email: "admin@demo.local", name: "Admin Klinik", role: "superadmin" },
  ] as const;
  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: { email: u.email, name: u.name, role: u.role, passwordHash: demoHash, active: true, tenantId: tenant.id },
      create: {
        id: u.id,
        tenantId: tenant.id,
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash: demoHash,
        active: true,
      },
    });
  }

  await prisma.site.upsert({
    where: { id: SEED.sites.bonn },
    update: {
      code: "BONN-A",
      address: "Klinikweg 1, 53127 Bonn",
      deliveryAddress: "Warenannahme Bonn · Central Medical Equipment Warehouse",
    },
    create: {
      id: SEED.sites.bonn,
      tenantId: tenant.id,
      name: "Bonn Clinic",
      code: "BONN-A",
      address: "Klinikweg 1, 53127 Bonn",
      deliveryAddress: "Warenannahme Bonn · Central Medical Equipment Warehouse",
    },
  });
  await prisma.site.upsert({
    where: { id: SEED.sites.cologne },
    update: {
      code: "CGN-1",
      address: "Domstraße 10, 50667 Köln",
      deliveryAddress: "Cologne Clinic, Goods Receipt, Domstraße 10, 50667 Köln",
    },
    create: {
      id: SEED.sites.cologne,
      tenantId: tenant.id,
      name: "Cologne Clinic",
      code: "CGN-1",
      address: "Domstraße 10, 50667 Köln",
      deliveryAddress: "Cologne Clinic, Goods Receipt, Domstraße 10, 50667 Köln",
    },
  });

  await prisma.area.upsert({
    where: { id: SEED.areas.bonnIcu },
    update: {},
    create: { id: SEED.areas.bonnIcu, siteId: SEED.sites.bonn, name: "ICU" },
  });
  await prisma.area.upsert({
    where: { id: SEED.areas.bonnRadiology },
    update: {},
    create: { id: SEED.areas.bonnRadiology, siteId: SEED.sites.bonn, name: "Radiology" },
  });
  await prisma.area.upsert({
    where: { id: SEED.areas.cologneOr },
    update: {},
    create: { id: SEED.areas.cologneOr, siteId: SEED.sites.cologne, name: "Operating Room" },
  });

  await prisma.deviceModel.upsert({
    where: { id: SEED.models.pumpX200 },
    update: { maintenanceCycleMonths: 12 },
    create: {
      id: SEED.models.pumpX200,
      basicUdiDi: "4012345X200BASIC",
      udiDi: SEED.gtins.pumpX200,
      gtins: JSON.stringify([SEED.gtins.pumpX200]),
      manufacturer: "Example Medical",
      manufacturerSrn: "DE-MF-000012345",
      tradeName: "Infusion Pump X200",
      modelName: "X200",
      riskClass: "IIb",
      emdnCode: "Z120301",
      gmdnCode: "13217",
      source: "catalog",
      state: "released",
      maintenanceCycleMonths: 12,
    },
  });

  await prisma.deviceModel.upsert({
    where: { id: SEED.models.monitorM10 },
    update: { maintenanceCycleMonths: 12 },
    create: {
      id: SEED.models.monitorM10,
      basicUdiDi: "4012345M10BASIC0",
      udiDi: SEED.gtins.monitorM10,
      gtins: JSON.stringify([SEED.gtins.monitorM10]),
      manufacturer: "Example Medical",
      tradeName: "Patient Monitor M10",
      modelName: "M10",
      riskClass: "IIa",
      emdnCode: "Z120501",
      source: "catalog",
      state: "released",
      maintenanceCycleMonths: 12,
    },
  });

  await prisma.deviceModel.upsert({
    where: { id: SEED.models.ventilatorV3 },
    update: { maintenanceCycleMonths: 6 },
    create: {
      id: SEED.models.ventilatorV3,
      udiDi: SEED.gtins.ventilatorV3,
      gtins: JSON.stringify([SEED.gtins.ventilatorV3]),
      manufacturer: "Example Respiratory",
      tradeName: "Ventilator V3",
      modelName: "V3",
      riskClass: "IIb",
      source: "catalog",
      state: "released",
      maintenanceCycleMonths: 6,
    },
  });

  const pumpCommissioned = new Date("2023-03-15T00:00:00.000Z");
  const monitorCommissioned = new Date("2024-01-10T00:00:00.000Z");

  await prisma.deviceInstance.upsert({
    where: { id: SEED.instances.pump },
    update: {
      maintenanceCycleMonths: 12,
      maintenanceAnchorAt: pumpCommissioned,
      nextMaintenanceDueAt: new Date("2024-03-15T00:00:00.000Z"),
      responsibleUserId: SEED.users.anna,
      responsiblePerson: "Anna Technik",
    },
    create: {
      id: SEED.instances.pump,
      tenantId: tenant.id,
      inventoryNumber: "INV-10001",
      serialNumber: "SN-10001",
      modelId: SEED.models.pumpX200,
      areaId: SEED.areas.bonnIcu,
      room: "Room 4",
      commissionedAt: pumpCommissioned,
      responsiblePerson: "Anna Technik",
      responsibleUserId: SEED.users.anna,
      maintenanceCycleMonths: 12,
      maintenanceAnchorAt: pumpCommissioned,
      nextMaintenanceDueAt: new Date("2024-03-15T00:00:00.000Z"),
    },
  });

  await prisma.deviceInstance.upsert({
    where: { id: SEED.instances.monitor },
    update: {
      maintenanceCycleMonths: 12,
      maintenanceAnchorAt: monitorCommissioned,
      nextMaintenanceDueAt: new Date("2025-01-10T00:00:00.000Z"),
    },
    create: {
      id: SEED.instances.monitor,
      tenantId: tenant.id,
      inventoryNumber: "INV-10002",
      serialNumber: "SN-10002",
      modelId: SEED.models.monitorM10,
      areaId: SEED.areas.bonnRadiology,
      room: "Room 12",
      commissionedAt: monitorCommissioned,
      maintenanceCycleMonths: 12,
      maintenanceAnchorAt: monitorCommissioned,
      nextMaintenanceDueAt: new Date("2025-01-10T00:00:00.000Z"),
    },
  });

  await prisma.classificationRule.upsert({
    where: { id: SEED.rules.pumpVerified },
    update: {},
    create: {
      id: SEED.rules.pumpVerified,
      matchType: "manufacturerModel",
      matchValue: "Example Medical|X200",
      annex1: true,
      annex2: false,
      softwareClass: null,
      radiation: false,
      confidence: "verified",
      source: "seed: manufacturer classification letter 2024-06",
      validFrom: new Date("2024-06-01T00:00:00.000Z"),
    },
  });

  await prisma.classificationRule.upsert({
    where: { id: SEED.rules.monitorDerived },
    update: {},
    create: {
      id: SEED.rules.monitorDerived,
      matchType: "emdn",
      matchValue: "Z120501",
      annex1: true,
      annex2: null,
      softwareClass: null,
      radiation: false,
      confidence: "derived",
      source: "seed: EMDN group heuristic",
    },
  });

  await prisma.classificationProposal.deleteMany({
    where: { deviceModelId: { in: [SEED.models.pumpX200, SEED.models.monitorM10] } },
  });
  await prisma.classificationProposal.create({
    data: {
      deviceModelId: SEED.models.pumpX200,
      ruleId: SEED.rules.pumpVerified,
      annex1: true,
      annex2: false,
      softwareClass: null,
      radiation: false,
      confidence: "verified",
      source: "seed: manufacturer classification letter 2024-06",
    },
  });
  await prisma.classificationProposal.create({
    data: {
      deviceModelId: SEED.models.monitorM10,
      ruleId: SEED.rules.monitorDerived,
      annex1: true,
      annex2: null,
      softwareClass: null,
      radiation: false,
      confidence: "derived",
      source: "seed: EMDN group heuristic",
    },
  });

  const mailSmtpAuth = {
    host: "ssl.mhosts.de",
    port: 587,
    secure: false,
    user: "noreply@mhosts.de",
    pass: "123456",
    from: "noreply@mhosts.de",
  };

  await prisma.dispatchTarget.upsert({
    where: { id: SEED.dispatchTargets.mail },
    update: {
      endpoint: "service@plusorder.de",
      enabled: true,
      auth: JSON.stringify(mailSmtpAuth),
    },
    create: {
      id: SEED.dispatchTargets.mail,
      tenantId: tenant.id,
      type: "mail",
      name: "Medical technology mailbox",
      endpoint: "service@plusorder.de",
      auth: JSON.stringify(mailSmtpAuth),
      enabled: true,
    },
  });
  await prisma.dispatchTarget.upsert({
    where: { id: SEED.dispatchTargets.oxid },
    update: {},
    create: {
      id: SEED.dispatchTargets.oxid,
      tenantId: tenant.id,
      type: "oxid",
      name: "OXID service desk",
      endpoint: null, // ⚠ PENDING API SPEC — mock adapter until then
      enabled: true,
      retryPolicy: JSON.stringify({ maxAttempts: 3, backoffMs: 2000 }),
    },
  });

  const roleGrantsCreated = await seedRoleGrantsIfEmpty(prisma);

  return {
    tenant: tenant.id,
    users: users.length,
    sites: 2,
    areas: 3,
    models: 3,
    instances: 2,
    rules: 2,
    dispatchTargets: 2,
    roleGrantsCreated,
  };
}

// Run as a script (`npm run db:seed`); tests import `seed()` directly instead.
const invokedDirectly = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedDirectly) {
  const prisma = new PrismaClient();
  seed(prisma)
    .then((summary) => console.log("Seed complete:", summary))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
