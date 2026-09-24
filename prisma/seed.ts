/**
 * Deterministic seed — Section 15.3.
 * Every id is fixed so unit/integration/e2e tests can reference them directly.
 * Running the seed repeatedly is safe: everything is upserted.
 */
import { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "node:url";
import { hashPassword } from "../src/lib/password";
import { seedRoleGrantsIfEmpty } from "../src/services/roles/roleGrantsService";
import { dutyService } from "../src/services/registration/dutyService";
import { seedHandoverInventory } from "./seeds/handoverInventory";
import { seedPartnerOrgs } from "./seeds/partnerOrgs";
import { seedRegistrationRef } from "./seeds/registrationRef";

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
    pumpX200: "model-pump-x200",
    monitorM10: "model-monitor-m10",
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
  classifications: {
    pump: "cls-pump-x200",
    monitor: "cls-monitor-m10",
  },
  dispatchTargets: {
    /** @deprecated legacy ids — remapped to O-INT in seed */
    mail: "dispatch-mail-demo",
    oxid: "dispatch-oxid-demo",
    msrMail: "dispatch-msr-mail",
    msrApi: "dispatch-msr-api",
    rtsMail: "dispatch-rts-mail",
    rtsApi: "dispatch-rts-api",
    intMail: "dispatch-mail-demo",
    intOxid: "dispatch-oxid-demo",
  },
  executors: {
    msr: "exec-o-msr",
    rts: "exec-o-rts",
    int: "exec-o-int",
  },
} as const;

export async function seed(prisma: PrismaClient) {
  await seedRegistrationRef(prisma);

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
      update: {
        email: u.email,
        name: u.name,
        role: u.role,
        accountKind: "clinic",
        passwordHash: demoHash,
        active: true,
        tenantId: tenant.id,
      },
      create: {
        id: u.id,
        tenantId: tenant.id,
        accountKind: "clinic",
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

  await prisma.siteHeadcount.deleteMany({ where: { siteId: { in: [SEED.sites.bonn, SEED.sites.cologne] } } });
  await prisma.siteHeadcount.create({
    data: {
      siteId: SEED.sites.bonn,
      validFrom: new Date("2024-01-01"),
      headcount: 18,
      recordedBy: "seed",
    },
  });
  await prisma.siteHeadcount.create({
    data: {
      siteId: SEED.sites.cologne,
      validFrom: new Date("2024-01-01"),
      headcount: 12,
      recordedBy: "seed",
    },
  });

  await prisma.deviceInstance.upsert({
    where: { id: SEED.instances.pump },
    update: {
      maintenanceCycleMonths: 12,
      maintenanceAnchorAt: pumpCommissioned,
      nextMaintenanceDueAt: new Date("2024-03-15T00:00:00.000Z"),
      responsibleUserId: SEED.users.anna,
      responsiblePerson: "Anna Technik",
      state: "released",
      source: "manual",
      productKindCode: "aktiv-therapie",
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
      state: "released",
      source: "manual",
      productKindCode: "aktiv-therapie",
    },
  });

  await prisma.deviceInstance.upsert({
    where: { id: SEED.instances.monitor },
    update: {
      maintenanceCycleMonths: 12,
      maintenanceAnchorAt: monitorCommissioned,
      nextMaintenanceDueAt: new Date("2025-01-10T00:00:00.000Z"),
      state: "released",
      source: "manual",
      productKindCode: "messgeraet",
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
      state: "released",
      source: "manual",
      productKindCode: "messgeraet",
    },
  });

  await prisma.deviceModelClassification.updateMany({
    where: { deviceModelId: { in: [SEED.models.pumpX200, SEED.models.monitorM10] }, validTo: null },
    data: { validTo: new Date() },
  });
  await prisma.deviceModelClassification.upsert({
    where: { id: SEED.classifications.pump },
    update: {
      deviceModelId: SEED.models.pumpX200,
      stk: true,
      radiation: false,
      softwareClass: null,
      confidence: "verified",
      evidenceText: "seed: manufacturer classification letter 2024-06",
      ruleSetId: "rs-mpbetreibv",
      confirmedBy: "seed",
      confirmedAt: new Date("2024-06-01T00:00:00.000Z"),
      validTo: null,
    },
    create: {
      id: SEED.classifications.pump,
      deviceModelId: SEED.models.pumpX200,
      stk: true,
      radiation: false,
      softwareClass: null,
      confidence: "verified",
      evidenceText: "seed: manufacturer classification letter 2024-06",
      ruleSetId: "rs-mpbetreibv",
      confirmedBy: "seed",
      confirmedAt: new Date("2024-06-01T00:00:00.000Z"),
    },
  });
  await prisma.deviceModelClassification.upsert({
    where: { id: SEED.classifications.monitor },
    update: {
      deviceModelId: SEED.models.monitorM10,
      stk: true,
      radiation: false,
      softwareClass: null,
      confidence: "derived",
      evidenceText: "seed: EMDN group heuristic",
      ruleSetId: "rs-mpbetreibv",
      validTo: null,
    },
    create: {
      id: SEED.classifications.monitor,
      deviceModelId: SEED.models.monitorM10,
      stk: true,
      radiation: false,
      softwareClass: null,
      confidence: "derived",
      evidenceText: "seed: EMDN group heuristic",
      ruleSetId: "rs-mpbetreibv",
    },
  });

  const mailSmtpAuth = {
    host: "ssl.mhosts.de",
    port: 587,
    secure: false,
    user: "noreply@mhosts.de",
    pass: "2mtyz^tE",
    from: "noreply@mhosts.de",
  };

  const executors = [
    { id: SEED.executors.msr, code: "O-MSR", name: "Medtech Service Rhein GmbH", kind: "external", sortOrder: 1 },
    { id: SEED.executors.rts, code: "O-RTS", name: "Radiotec Service", kind: "external", sortOrder: 2 },
    { id: SEED.executors.int, code: "O-INT", name: "Eigene Medizintechnik", kind: "internal", sortOrder: 3 },
  ] as const;
  for (const ex of executors) {
    await prisma.executorOrg.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: ex.code } },
      update: { name: ex.name, kind: ex.kind, active: true, sortOrder: ex.sortOrder },
      create: {
        id: ex.id,
        tenantId: tenant.id,
        code: ex.code,
        name: ex.name,
        kind: ex.kind,
        active: true,
        sortOrder: ex.sortOrder,
      },
    });
  }

  // Per-org channels — each partner owns mail + API (enabled independently).
  const orgTargets: {
    id: string;
    executorOrgId: string;
    type: string;
    name: string;
    endpoint: string | null;
    auth?: string;
    retryPolicy?: string;
  }[] = [
    {
      id: SEED.dispatchTargets.msrMail,
      executorOrgId: SEED.executors.msr,
      type: "mail",
      name: "MSR mailbox",
      endpoint: "msr@medtech-rhein.example",
      auth: JSON.stringify(mailSmtpAuth),
    },
    {
      id: SEED.dispatchTargets.msrApi,
      executorOrgId: SEED.executors.msr,
      type: "webhook",
      name: "MSR partner API",
      endpoint: "mock://ok",
    },
    {
      id: SEED.dispatchTargets.rtsMail,
      executorOrgId: SEED.executors.rts,
      type: "mail",
      name: "RTS mailbox",
      endpoint: "service@radiotec.example",
      auth: JSON.stringify(mailSmtpAuth),
    },
    {
      id: SEED.dispatchTargets.rtsApi,
      executorOrgId: SEED.executors.rts,
      type: "webhook",
      name: "RTS partner API",
      endpoint: "mock://ok",
    },
    {
      id: SEED.dispatchTargets.intMail,
      executorOrgId: SEED.executors.int,
      type: "mail",
      name: "Medical technology mailbox",
      endpoint: "service@plusorder.de",
      auth: JSON.stringify(mailSmtpAuth),
    },
    {
      id: SEED.dispatchTargets.intOxid,
      executorOrgId: SEED.executors.int,
      type: "oxid",
      name: "OXID service desk",
      endpoint: null,
      retryPolicy: JSON.stringify({ maxAttempts: 3, backoffMs: 2000 }),
    },
  ];

  for (const t of orgTargets) {
    await prisma.dispatchTarget.upsert({
      where: { id: t.id },
      update: {
        executorOrgId: t.executorOrgId,
        type: t.type,
        name: t.name,
        endpoint: t.endpoint,
        auth: t.auth ?? null,
        retryPolicy: t.retryPolicy ?? null,
        enabled: true,
      },
      create: {
        id: t.id,
        tenantId: tenant.id,
        executorOrgId: t.executorOrgId,
        type: t.type,
        name: t.name,
        endpoint: t.endpoint,
        auth: t.auth ?? null,
        retryPolicy: t.retryPolicy ?? null,
        enabled: true,
      },
    });
  }

  // Disable any leftover unowned targets from earlier seeds.
  await prisma.dispatchTarget.updateMany({
    where: { tenantId: tenant.id, executorOrgId: null },
    data: { enabled: false },
  });

  const roleGrantsCreated = await seedRoleGrantsIfEmpty(prisma);

  const partners = await seedPartnerOrgs(prisma, tenant.id);

  // Handover testdaten → existing Prisma models only; all under demo-tenant.
  const handover = await seedHandoverInventory(prisma, tenant.id);

  const dutiesBackfilled = await dutyService.backfillDueDates(prisma);

  return {
    tenant: tenant.id,
    users: users.length,
    sites: 2 + handover.sites,
    areas: 3 + handover.areas,
    models: 3 + handover.models,
    instances: 2 + handover.instances,
    classifications: 2 + handover.classifications,
    dispatchTargets: orgTargets.length,
    executorOrgs: executors.length,
    roleGrantsCreated,
    partners,
    handover,
    dutiesBackfilled,
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
