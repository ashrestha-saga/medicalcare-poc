/**
 * E70–E80 repairs package seed — idempotent upserts by code/key.
 * Enables the tenant flag, K-REP catalogue, repair quals, training gate,
 * geraete-gesperrt tile, and a light demo part row (CS2-SK-01).
 */
import type { PrismaClient, StepInputKind } from "@prisma/client";
import { K_REP_CATALOGUE_CODE } from "../../src/constants/repairs";

/** Mirrors SEED in prisma/seed.ts — avoid circular import. */
const DEMO_TENANT_ID = "demo-tenant";
const DEMO_PUMP_INSTANCE_ID = "instance-inv-10001";

const RULE_SET_ID = "rs-mpbetreibv";
const REPAIR_TYPE_CODE = "REPAIR";
const MSR_ORG_ID = "1f0f2544-0dc8-5869-9c13-85f741e48258";

const K_REP_STEPS: Array<{
  position: number;
  label: string;
  inputKind: StepInputKind;
  isMeasurement?: boolean;
  optionsJson?: unknown;
}> = [
  {
    position: 1,
    label: "Störung bestätigt (Abweichung)",
    inputKind: "check",
  },
  {
    position: 2,
    label: "Ursache",
    inputKind: "text",
  },
  {
    position: 3,
    label: "Maßnahme",
    inputKind: "select",
    optionsJson: [
      "repaired",
      "part_replaced",
      "software",
      "adjustment",
      "provisional",
      "not_repairable",
      "parts_ordered",
    ],
  },
  {
    position: 4,
    label: "Austauschteile",
    inputKind: "parts",
  },
  {
    position: 5,
    label: "Arbeitszeit (Minuten) / Software vor/nach",
    inputKind: "number",
  },
  {
    position: 6,
    label: "Funktionstest",
    inputKind: "measurement",
    isMeasurement: true,
  },
  {
    position: 7,
    label: "Ergebnis / sicherheitsrelevant",
    inputKind: "result",
  },
];

const REPAIR_QUALIFICATIONS = [
  {
    code: "repair_medisens",
    label: "Herstellerschulung Medisens (Instandsetzung)",
    legalBasis: "§ 7 MPBetreibV · Herstellervorgabe",
  },
  {
    code: "repair_fresenius",
    label: "Herstellerschulung Fresenius (Instandsetzung)",
    legalBasis: "§ 7 MPBetreibV · Herstellervorgabe",
  },
  {
    code: "repair_example_medical",
    label: "Herstellerschulung Example Medical (Instandsetzung)",
    legalBasis: "§ 7 MPBetreibV · Herstellervorgabe",
  },
] as const;

const TILE_KEY = "geraete-gesperrt";
const TILE_ROLES = ["device_admin", "security_officer", "superadmin"] as const;

const DEMO_MAINT_EVENT_ID = "me-rep-demo-cs2";
const DEMO_MAINT_PART_ID = "mp-rep-demo-cs2-sk-01";

export async function seedRepairs(prisma: PrismaClient) {
  const existing = await prisma.tenant.findUnique({
    where: { id: DEMO_TENANT_ID },
    select: { featureFlags: true },
  });
  const prev =
    existing?.featureFlags &&
    typeof existing.featureFlags === "object" &&
    !Array.isArray(existing.featureFlags)
      ? (existing.featureFlags as Record<string, unknown>)
      : {};
  await prisma.tenant.update({
    where: { id: DEMO_TENANT_ID },
    data: { featureFlags: { ...prev, repairs: true } },
  });

  await prisma.refInspectionType.upsert({
    where: { code: REPAIR_TYPE_CODE },
    update: {
      label: "Instandsetzung / Reparatur",
      legalBasis: "§ 7 MPBetreibV",
      category: "operating",
      ruleSetId: RULE_SET_ID,
    },
    create: {
      code: REPAIR_TYPE_CODE,
      ruleSetId: RULE_SET_ID,
      label: "Instandsetzung / Reparatur",
      legalBasis: "§ 7 MPBetreibV",
      deadlineAnchor: "event",
      defaultInterval: null,
      intervalUnit: null,
      evidenceHint: "Instandsetzungsbericht (K-REP), Eintrag im Medizinproduktebuch Nr. 4",
      category: "operating",
      confidence: "derived",
      sourceRef: "§ 7 Abs. 1–2 MPBetreibV",
    },
  });

  for (const q of REPAIR_QUALIFICATIONS) {
    await prisma.refQualification.upsert({
      where: { code: q.code },
      update: { label: q.label, legalBasis: q.legalBasis, ruleSetId: RULE_SET_ID },
      create: {
        code: q.code,
        label: q.label,
        legalBasis: q.legalBasis,
        ruleSetId: RULE_SET_ID,
      },
    });
  }

  await prisma.refValidationOccasion.upsert({
    where: { code: "repair" },
    update: { label: "Instandsetzung / Reparatur" },
    create: { code: "repair", label: "Instandsetzung / Reparatur" },
  });

  const catalogueId = `cat-${K_REP_CATALOGUE_CODE}`;
  await prisma.refInspectionCatalogue.upsert({
    where: { ruleSetId_code: { ruleSetId: RULE_SET_ID, code: K_REP_CATALOGUE_CODE } },
    update: {
      inspectionTypeCode: REPAIR_TYPE_CODE,
      scope: "generic",
      scopeValue: null,
      label: "Instandsetzungsbericht (K-REP)",
      legalBasis: "§ 7 MPBetreibV",
      retention: "Dauer der Verwendung + 5 Jahre",
      draft: false,
      noCatalogue: false,
      occasions: ["repair"],
      note: "Reparaturformular — 7 Schritte mit inputKind",
    },
    create: {
      id: catalogueId,
      ruleSetId: RULE_SET_ID,
      code: K_REP_CATALOGUE_CODE,
      inspectionTypeCode: REPAIR_TYPE_CODE,
      scope: "generic",
      label: "Instandsetzungsbericht (K-REP)",
      legalBasis: "§ 7 MPBetreibV",
      retention: "Dauer der Verwendung + 5 Jahre",
      occasions: ["repair"],
      note: "Reparaturformular — 7 Schritte mit inputKind",
    },
  });

  const savedCat = await prisma.refInspectionCatalogue.findUnique({
    where: { ruleSetId_code: { ruleSetId: RULE_SET_ID, code: K_REP_CATALOGUE_CODE } },
    select: { id: true },
  });
  if (!savedCat) throw new Error("K-REP catalogue missing after upsert");

  for (const step of K_REP_STEPS) {
    const stepId = `step-${K_REP_CATALOGUE_CODE}-${step.position}`;
    await prisma.refInspectionStep.upsert({
      where: { catalogueId_position: { catalogueId: savedCat.id, position: step.position } },
      update: {
        label: step.label,
        isMeasurement: Boolean(step.isMeasurement),
        inputKind: step.inputKind,
        optionsJson: step.optionsJson ?? undefined,
      },
      create: {
        id: stepId,
        catalogueId: savedCat.id,
        position: step.position,
        label: step.label,
        isMeasurement: Boolean(step.isMeasurement),
        inputKind: step.inputKind,
        optionsJson: step.optionsJson ?? undefined,
      },
    });
  }

  // E78 — thin generic fallbacks when annex2/equipment/constancy scope miss.
  async function upsertGenericCatalogue(input: {
    code: string;
    inspectionTypeCode: string;
    label: string;
    legalBasis: string;
    note: string;
    steps: string[];
  }) {
    const id = `cat-${input.code}`;
    await prisma.refInspectionCatalogue.upsert({
      where: { ruleSetId_code: { ruleSetId: RULE_SET_ID, code: input.code } },
      update: {
        inspectionTypeCode: input.inspectionTypeCode,
        scope: "generic",
        scopeValue: null,
        label: input.label,
        legalBasis: input.legalBasis,
        draft: false,
        noCatalogue: false,
        occasions: ["repair"],
        note: input.note,
      },
      create: {
        id,
        ruleSetId: RULE_SET_ID,
        code: input.code,
        inspectionTypeCode: input.inspectionTypeCode,
        scope: "generic",
        label: input.label,
        legalBasis: input.legalBasis,
        occasions: ["repair"],
        note: input.note,
      },
    });
    const cat = await prisma.refInspectionCatalogue.findUnique({
      where: { ruleSetId_code: { ruleSetId: RULE_SET_ID, code: input.code } },
      select: { id: true },
    });
    if (!cat) throw new Error(`${input.code} catalogue missing`);
    for (let i = 0; i < input.steps.length; i++) {
      const position = i + 1;
      await prisma.refInspectionStep.upsert({
        where: { catalogueId_position: { catalogueId: cat.id, position } },
        update: { label: input.steps[i]!, isMeasurement: false, inputKind: "check" },
        create: {
          id: `step-${input.code}-${position}`,
          catalogueId: cat.id,
          position,
          label: input.steps[i]!,
          isMeasurement: false,
          inputKind: "check",
        },
      });
    }
  }

  await upsertGenericCatalogue({
    code: "K-MTK-gen",
    inspectionTypeCode: "MTK",
    label: "MTK nach Instandsetzung (generisch)",
    legalBasis: "§ 14 / § 7 Abs. 2 MPBetreibV",
    note: "E78 fallback when no Anlage-2 catalogue matches",
    steps: [
      "Prüfmittel und Umgebungsbedingungen dokumentiert",
      "Messtechnische Kontrolle nach Herstellerangabe",
      "Abweichungen bewertet und dokumentiert",
      "Kennzeichnung / Prüfplakette",
    ],
  });

  await upsertGenericCatalogue({
    code: "K-PNI",
    inspectionTypeCode: "VALIDATION",
    label: "Erneute Leistungsbeurteilung nach Instandsetzung",
    legalBasis: "§ 8 / § 7 Abs. 2 MPBetreibV · KRINKO/BfArM",
    note: "E78 fallback requalification after repair",
    steps: [
      "Instandsetzungsbericht vorliegend",
      "Funktionsprüfung der kritischen Prozessparameter",
      "Sichtprüfung der relevanten Baugruppen",
      "Freigabeentscheidung dokumentiert",
      "Kennzeichnung am Produkt",
    ],
  });

  // E79 — do not bind OEM trainings to REPAIR type/catalogue; gate owns enforcement.
  await prisma.refQualificationRule.deleteMany({
    where: {
      inspectionTypeCode: REPAIR_TYPE_CODE,
      qualificationCode: { in: REPAIR_QUALIFICATIONS.map((q) => q.code) },
    },
  });

  // E79 — OEM trainings are person + manufacturer gate, not catalogue-wide.
  // Detach any prior seed links so K-REP start does not require all three OEMs.
  await prisma.refCatalogueQualification.deleteMany({
    where: {
      catalogueId: savedCat.id,
      qualificationCode: { in: REPAIR_QUALIFICATIONS.map((q) => q.code) },
    },
  });

  // Demo: Adler holds Medisens repair training (gate demo / K-REP start).
  const adlerId = "user-partner-msr-adler";
  if (await prisma.user.findUnique({ where: { id: adlerId }, select: { id: true } })) {
    await prisma.personQualification.upsert({
      where: {
        userId_qualificationCode: {
          userId: adlerId,
          qualificationCode: "repair_medisens",
        },
      },
      update: {},
      create: {
        id: "pq-adler-repair-medisens",
        userId: adlerId,
        qualificationCode: "repair_medisens",
        validUntil: null,
        evidenceRef: "Seed · Herstellerschulung Medisens",
        recordedBy: "seed",
      },
    });
  }

  const msr = await prisma.organisation.findUnique({ where: { id: MSR_ORG_ID } });
  if (msr) {
    await prisma.manufacturerTrainingGate.upsert({
      where: {
        organisationId_manufacturer: {
          organisationId: MSR_ORG_ID,
          manufacturer: "Medisens",
        },
      },
      update: { gate: "block", setBy: "seed" },
      create: {
        id: "mtg-msr-medisens",
        organisationId: MSR_ORG_ID,
        manufacturer: "Medisens",
        gate: "block",
        setBy: "seed",
      },
    });
    await prisma.manufacturerTrainingGate.upsert({
      where: {
        organisationId_manufacturer: {
          organisationId: MSR_ORG_ID,
          manufacturer: "Fresenius",
        },
      },
      update: { gate: "hint", setBy: "seed" },
      create: {
        id: "mtg-msr-fresenius",
        organisationId: MSR_ORG_ID,
        manufacturer: "Fresenius",
        gate: "hint",
        setBy: "seed",
      },
    });
  }

  await prisma.refDashboardTile.upsert({
    where: { key: TILE_KEY },
    update: {
      title: "Geräte gesperrt / außer Betrieb",
      question: "Welche Geräte sind gesperrt oder in Instandsetzung?",
      zone: "decides",
      sortOrder: 8,
      dutyKey: null,
      requiredPermission: "inventory:view",
      partnerOnly: false,
      note: "E70 — operationalState ∈ {locked, under_repair}",
    },
    create: {
      key: TILE_KEY,
      title: "Geräte gesperrt / außer Betrieb",
      question: "Welche Geräte sind gesperrt oder in Instandsetzung?",
      zone: "decides",
      sortOrder: 8,
      dutyKey: null,
      requiredPermission: "inventory:view",
      partnerOnly: false,
      note: "E70 — operationalState ∈ {locked, under_repair}",
    },
  });

  for (const role of TILE_ROLES) {
    await prisma.dashboardTileGrant.upsert({
      where: { role_tileKey: { role, tileKey: TILE_KEY } },
      update: {},
      create: { role, tileKey: TILE_KEY },
    });
  }

  // Normalise demo INV on the existing pump instance (idempotent).
  const pump = await prisma.deviceInstance.findUnique({
    where: { id: DEMO_PUMP_INSTANCE_ID },
    select: { id: true },
  });
  if (pump) {
    await prisma.deviceInstance.update({
      where: { id: DEMO_PUMP_INSTANCE_ID },
      data: {
        inventoryNumber: "INV-10001",
        operationalState: "in_service",
        lockSource: null,
      },
    });

    // Light sample MaintenanceEvent + part (CS2-SK-01) for parts-proposal demos.
    await prisma.maintenanceEvent.upsert({
      where: { id: DEMO_MAINT_EVENT_ID },
      update: {
        kind: "repair",
        note: "seed: sample repair event for CS2-SK-01 part fixture",
        source: "partner",
        performedBy: "seed",
      },
      create: {
        id: DEMO_MAINT_EVENT_ID,
        tenantId: DEMO_TENANT_ID,
        deviceInstanceId: DEMO_PUMP_INSTANCE_ID,
        kind: "repair",
        performedAt: new Date("2026-09-16T10:00:00.000Z"),
        note: "seed: sample repair event for CS2-SK-01 part fixture",
        source: "partner",
        performedBy: "seed",
        resultText: "parts_ordered — Schallkopf",
      },
    });
    await prisma.maintenancePart.upsert({
      where: { id: DEMO_MAINT_PART_ID },
      update: {
        description: "Schallkopf CS-2",
        partNo: "CS2-SK-01",
        qty: 1,
      },
      create: {
        id: DEMO_MAINT_PART_ID,
        tenantId: DEMO_TENANT_ID,
        maintenanceEventId: DEMO_MAINT_EVENT_ID,
        description: "Schallkopf CS-2",
        partNo: "CS2-SK-01",
        qty: 1,
      },
    });

    const executor = await prisma.executorOrg.findFirst({
      where: { organisationId: MSR_ORG_ID },
      select: { id: true },
    });
    const site = await prisma.site.findFirst({
      where: { tenantId: DEMO_TENANT_ID },
      select: { id: true, name: true, address: true, deliveryAddress: true },
    });
    if (executor && site) {
      const locationText = site.name;
      const deliveryAddress = site.deliveryAddress?.trim() || site.address?.trim() || locationText;

      await prisma.serviceRequest.upsert({
        where: { idempotencyKey: "seed-partner-order-onsite" },
        update: {
          fulfilment: "on_site",
          reason: "stoerung",
          serviceType: "repair",
          transmittedAt: new Date("2026-09-20T08:00:00.000Z"),
          state: "handed_off",
          executorOrgId: executor.id,
          faultDescription: "seed: partner phone-path on-site repair",
          faultConsequence: "out_of_service",
          faultReportedBy: "seed",
        },
        create: {
          id: "sr-partner-create-onsite",
          reference: "SR-SEED-PARTNER-ONSITE",
          idempotencyKey: "seed-partner-order-onsite",
          fingerprint: "seed-partner-order-onsite",
          tenantId: DEMO_TENANT_ID,
          subjectType: "instance",
          subjectId: DEMO_PUMP_INSTANCE_ID,
          serviceType: "repair",
          reason: "stoerung",
          fulfilment: "on_site",
          priority: "critical",
          raisedBy: "seed",
          siteId: site.id,
          locationText,
          deliveryAddress,
          state: "handed_off",
          source: "app",
          executorOrgId: executor.id,
          allocatedAt: new Date("2026-09-20T08:00:00.000Z"),
          allocatedBy: "seed",
          transmittedAt: new Date("2026-09-20T08:00:00.000Z"),
          faultDescription: "seed: partner phone-path on-site repair",
          faultSince: new Date("2026-09-18"),
          faultConsequence: "out_of_service",
          faultReportedBy: "seed",
        },
      });

      await prisma.serviceRequest.upsert({
        where: { idempotencyKey: "seed-partner-order-sendin" },
        update: {
          fulfilment: "send_in",
          reason: "stoerung",
          serviceType: "repair",
          transmittedAt: new Date("2026-09-23T08:00:00.000Z"),
          state: "in_progress",
          executorOrgId: executor.id,
          note: "Werkstatt: Sono Repair GmbH",
          shippedAt: new Date("2026-09-23"),
          trackingRef: "SEED-TRACK-4474",
          atWorkshopAt: new Date("2026-09-25"),
          faultDescription: "seed: partner send-in probe repair",
          faultConsequence: "restricted",
          faultReportedBy: "seed",
        },
        create: {
          id: "sr-partner-create-sendin",
          reference: "SR-SEED-PARTNER-SENDIN",
          idempotencyKey: "seed-partner-order-sendin",
          fingerprint: "seed-partner-order-sendin",
          tenantId: DEMO_TENANT_ID,
          subjectType: "instance",
          subjectId: DEMO_PUMP_INSTANCE_ID,
          serviceType: "repair",
          reason: "stoerung",
          fulfilment: "send_in",
          priority: "high",
          note: "Werkstatt: Sono Repair GmbH",
          raisedBy: "seed",
          siteId: site.id,
          locationText,
          deliveryAddress,
          state: "in_progress",
          source: "app",
          executorOrgId: executor.id,
          allocatedAt: new Date("2026-09-23T08:00:00.000Z"),
          allocatedBy: "seed",
          transmittedAt: new Date("2026-09-23T08:00:00.000Z"),
          shippedAt: new Date("2026-09-23"),
          trackingRef: "SEED-TRACK-4474",
          atWorkshopAt: new Date("2026-09-25"),
          faultDescription: "seed: partner send-in probe repair",
          faultSince: new Date("2026-09-20"),
          faultConsequence: "restricted",
          faultReportedBy: "seed",
        },
      });
    }
  }

  return {
    tenantId: DEMO_TENANT_ID,
    catalogueCode: K_REP_CATALOGUE_CODE,
    qualifications: REPAIR_QUALIFICATIONS.length,
    tileKey: TILE_KEY,
    partNo: "CS2-SK-01",
  };
}
