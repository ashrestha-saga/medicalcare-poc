/**
 * Five golden catalog exemplars — full quality chain:
 * DeviceModel → open classification (Merkmale JSON + flags + family)
 * → DeviceInstance → ReleaseSnapshot → DeviceDuty (via deriveDuties + writeDuty).
 *
 * Product kinds intentionally span different RefProductKind shows/blocks matrices.
 */
import type { PrismaClient } from "@prisma/client";
import {
  deriveDuties,
  stkFlagFromDuties,
  type Annex2Lookup,
} from "../../src/services/registration/deriveDuties";
import { extractModelCharacteristics } from "../../src/services/registration/modelCharacteristics";
import type { RegistrationCharacteristics } from "../../src/services/registration/types";
import { writeDuty } from "../../src/services/registration/writeDuty";

/** Stable demo ids — keep in sync with SEED in prisma/seed.ts (avoid circular import). */
const DEMO = {
  users: { anna: "user-tech-1" },
  areas: {
    bonnIcu: "area-bonn-icu",
    bonnRadiology: "area-bonn-radiology",
    cologneOr: "area-cologne-or",
  },
} as const;

export const GOLDEN = {
  models: {
    deficare: "model-deficare-x9",
    tonosure: "model-tonosure-pro",
    sonovista: "model-sonovista-e4",
    cardioview: "model-cardioview-cloud",
    steriwash: "model-steriwash-rs200",
  },
  gtins: {
    /** GS1 check digits validated via isValidGtinCheckDigit (weight from the right). */
    deficare: "04012345679007",
    tonosure: "04012345679014",
    sonovista: "04012345679021",
    cardioview: "04012345679038",
    steriwash: "04012345679045",
  },
  classifications: {
    deficare: "cls-deficare-x9",
    tonosure: "cls-tonosure-pro",
    sonovista: "cls-sonovista-e4",
    cardioview: "cls-cardioview-cloud",
    steriwash: "cls-steriwash-rs200",
  },
  instances: {
    deficare: "instance-inv-golden-defi",
    tonosure: "instance-inv-golden-tono",
    sonovista: "instance-inv-golden-sono",
    cardioview: "instance-inv-golden-cardio",
    steriwash: "instance-inv-golden-steri",
  },
  snapshots: {
    deficare: "snap-golden-defi",
    tonosure: "snap-golden-tono",
    sonovista: "snap-golden-sono",
    cardioview: "snap-golden-cardio",
    steriwash: "snap-golden-steri",
  },
} as const;

const ANNEX_TONOMETER = "annex2-MTK-1.4.1";

type ExemplarKey = keyof typeof GOLDEN.models;

interface ExemplarSpec {
  key: ExemplarKey;
  manufacturer: string;
  tradeName: string;
  modelName: string;
  riskClass: string;
  emdnCode?: string;
  maintenanceCycleMonths: number;
  areaId: string;
  room: string;
  inventoryNumber: string;
  serialNumber: string;
  commissionedAt: Date;
  deviceFamilyCode?: string;
  appliedPartCode?: string;
  characteristics: RegistrationCharacteristics;
  annex2?: Annex2Lookup | null;
}

function baseMerkmale(
  partial: RegistrationCharacteristics,
): RegistrationCharacteristics {
  return {
    vernetzt: false,
    implantat: false,
    istAufbGeraet: false,
    einmalprodukt: false,
    software: false,
    strahlung: false,
    aufbereitung: false,
    wartungQuelle: "hersteller",
    wartungIntervall: 12,
    ...partial,
  };
}

const EXEMPLARS: ExemplarSpec[] = [
  {
    key: "deficare",
    manufacturer: "LifePulse Medical",
    tradeName: "DefiCare X9",
    modelName: "X9",
    riskClass: "IIb",
    emdnCode: "Z120301",
    maintenanceCycleMonths: 12,
    areaId: DEMO.areas.bonnIcu,
    room: "ER-1",
    inventoryNumber: "INV-GOLD-DEFI",
    serialNumber: "DCX9-10001",
    commissionedAt: new Date("2023-06-01T00:00:00.000Z"),
    deviceFamilyCode: "defi",
    appliedPartCode: "BF",
    characteristics: baseMerkmale({
      produktart: "aktiv-therapie",
      aktiv: true,
      anlage1: true,
      wartungIntervall: 12,
      vernetzt: true,
    }),
  },
  {
    key: "tonosure",
    manufacturer: "OptiMetrix GmbH",
    tradeName: "TonoSure Pro",
    modelName: "TSP-200",
    riskClass: "IIa",
    emdnCode: "Z120401",
    maintenanceCycleMonths: 12,
    areaId: DEMO.areas.bonnRadiology,
    room: "OPH-2",
    inventoryNumber: "INV-GOLD-TONO",
    serialNumber: "TSP-200-4421",
    commissionedAt: new Date("2024-02-15T00:00:00.000Z"),
    appliedPartCode: "B",
    characteristics: baseMerkmale({
      produktart: "messgeraet",
      aktiv: true,
      anlage1: true,
      anlage2Ziffer: "1.4.1",
      anlage2ItemId: ANNEX_TONOMETER,
      messgroesse: "augeninnendruck",
      wartungIntervall: 12,
    }),
    annex2: {
      itemNo: "1.4.1",
      label: "Augentonometer, allgemein",
      intervalYears: 2,
      isGroup: false,
      confidence: "derived",
      sourceRef: "Anlage 2 Nr. 1.4.1",
    },
  },
  {
    key: "sonovista",
    manufacturer: "EchoNova Systems",
    tradeName: "SonoVista E4",
    modelName: "E4",
    riskClass: "IIa",
    emdnCode: "Z110401",
    maintenanceCycleMonths: 12,
    areaId: DEMO.areas.cologneOr,
    room: "US-3",
    inventoryNumber: "INV-GOLD-SONO",
    serialNumber: "SVE4-7788",
    commissionedAt: new Date("2023-11-20T00:00:00.000Z"),
    deviceFamilyCode: "ultraschall",
    appliedPartCode: "BF",
    characteristics: baseMerkmale({
      produktart: "sonografie",
      aktiv: true,
      anlage1: true,
      aufbereitung: true,
      aufbKlasse: "semikritisch-a",
      wartungIntervall: 12,
      vernetzt: true,
      zubehoer: [{ t: "Schallkopf", klasse: "semikritisch-a" }],
    }),
  },
  {
    key: "cardioview",
    manufacturer: "Nexus Health Soft",
    tradeName: "CardioView Cloud",
    modelName: "CVC-1",
    riskClass: "IIa",
    emdnCode: "Z12050282",
    maintenanceCycleMonths: 12,
    areaId: DEMO.areas.bonnIcu,
    room: "IT-RACK",
    inventoryNumber: "INV-GOLD-CARDIO",
    serialNumber: "CVC1-LIC-9001",
    commissionedAt: new Date("2024-05-01T00:00:00.000Z"),
    characteristics: baseMerkmale({
      produktart: "software",
      software: true,
      swKlasse: "IIa",
      vernetzt: true,
      wartungIntervall: 12,
      // No aktiv/anlage1 — STK/MTK blocked by product-kind matrix.
    }),
  },
  {
    key: "steriwash",
    manufacturer: "CleanSteril AG",
    tradeName: "SteriWash RS-200",
    modelName: "RS-200",
    riskClass: "IIb",
    emdnCode: "Z120190",
    maintenanceCycleMonths: 6,
    areaId: DEMO.areas.cologneOr,
    room: "CSSD-A",
    inventoryNumber: "INV-GOLD-STERI",
    serialNumber: "RS200-3310",
    commissionedAt: new Date("2022-09-10T00:00:00.000Z"),
    appliedPartCode: "keines",
    characteristics: baseMerkmale({
      produktart: "aufbereitungsgeraet",
      aktiv: true,
      anlage1: true,
      istAufbGeraet: true,
      eigenTyp: "rdg",
      wartungIntervall: 6,
      vernetzt: true,
      // aufbereitung blocked for this kind — device is the washer, not the product.
    }),
  },
];

async function clearExemplarChain(prisma: PrismaClient, instanceId: string, snapshotId: string) {
  const duties = await prisma.deviceDuty.findMany({
    where: { deviceInstanceId: instanceId },
    select: { id: true },
  });
  const dutyIds = duties.map((d) => d.id);
  if (dutyIds.length) {
    await prisma.dutyReminder.deleteMany({ where: { deviceDutyId: { in: dutyIds } } });
    await prisma.dutyPerformance.deleteMany({ where: { deviceDutyId: { in: dutyIds } } });
    await prisma.inspectionRun.deleteMany({ where: { deviceDutyId: { in: dutyIds } } });
    await prisma.serviceRequest.updateMany({
      where: { dutyId: { in: dutyIds } },
      data: { dutyId: null },
    });
    await prisma.deviceDuty.deleteMany({ where: { id: { in: dutyIds } } });
  }
  await prisma.deviceReleaseSnapshot.deleteMany({
    where: { OR: [{ id: snapshotId }, { deviceInstanceId: instanceId }] },
  });
}

export async function seedGoldenCatalog(prisma: PrismaClient, tenantId: string) {
  let models = 0;
  let classifications = 0;
  let instances = 0;
  let duties = 0;

  for (const spec of EXEMPLARS) {
    const modelId = GOLDEN.models[spec.key];
    const gtin = GOLDEN.gtins[spec.key];
    const clsId = GOLDEN.classifications[spec.key];
    const instanceId = GOLDEN.instances[spec.key];
    const snapshotId = GOLDEN.snapshots[spec.key];
    const chars = spec.characteristics;
    const modelChars = extractModelCharacteristics(chars);
    const derived = deriveDuties({
      characteristics: chars,
      annex2: spec.annex2 ?? null,
    });
    const stk = stkFlagFromDuties(derived);
    const mtkItemId = chars.anlage2ItemId ?? null;

    const basicUdiDi = `BASIC-${spec.key.toUpperCase()}-${gtin}`;
    await prisma.deviceModel.upsert({
      where: { id: modelId },
      update: {
        basicUdiDi,
        udiDi: gtin,
        gtins: JSON.stringify([gtin]),
        manufacturer: spec.manufacturer,
        tradeName: spec.tradeName,
        modelName: spec.modelName,
        riskClass: spec.riskClass,
        emdnCode: spec.emdnCode ?? null,
        source: "catalog",
        state: "released",
        maintenanceCycleMonths: spec.maintenanceCycleMonths,
      },
      create: {
        id: modelId,
        basicUdiDi,
        udiDi: gtin,
        gtins: JSON.stringify([gtin]),
        manufacturer: spec.manufacturer,
        tradeName: spec.tradeName,
        modelName: spec.modelName,
        riskClass: spec.riskClass,
        emdnCode: spec.emdnCode ?? null,
        source: "catalog",
        state: "released",
        maintenanceCycleMonths: spec.maintenanceCycleMonths,
      },
    });
    models += 1;

    await prisma.deviceModelClassification.updateMany({
      where: { deviceModelId: modelId, validTo: null },
      data: { validTo: new Date(), openClassificationKey: null },
    });

    await prisma.deviceModelClassification.upsert({
      where: { id: clsId },
      update: {
        deviceModelId: modelId,
        openClassificationKey: modelId,
        validTo: null,
        stk,
        mtkItemId,
        radiation: Boolean(chars.strahlung),
        softwareClass: chars.software ? (chars.swKlasse ?? "IIa") : null,
        confidence: "verified",
        evidenceText: `seed:golden ${spec.tradeName} — full Merkmale for catalog-link reuse`,
        ruleSetId: "rs-mpbetreibv",
        confirmedBy: "seed",
        confirmedAt: new Date("2024-01-15T00:00:00.000Z"),
        productKindCode: chars.produktart,
        characteristics: JSON.stringify(modelChars),
        deviceFamilyCode: spec.deviceFamilyCode ?? null,
        appliedPartCode: spec.appliedPartCode ?? null,
      },
      create: {
        id: clsId,
        deviceModelId: modelId,
        openClassificationKey: modelId,
        stk,
        mtkItemId,
        radiation: Boolean(chars.strahlung),
        softwareClass: chars.software ? (chars.swKlasse ?? "IIa") : null,
        confidence: "verified",
        evidenceText: `seed:golden ${spec.tradeName} — full Merkmale for catalog-link reuse`,
        ruleSetId: "rs-mpbetreibv",
        confirmedBy: "seed",
        confirmedAt: new Date("2024-01-15T00:00:00.000Z"),
        productKindCode: chars.produktart,
        characteristics: JSON.stringify(modelChars),
        deviceFamilyCode: spec.deviceFamilyCode ?? null,
        appliedPartCode: spec.appliedPartCode ?? null,
      },
    });
    classifications += 1;

    await clearExemplarChain(prisma, instanceId, snapshotId);

    await prisma.deviceInstance.upsert({
      where: { id: instanceId },
      update: {
        tenantId,
        inventoryNumber: spec.inventoryNumber,
        serialNumber: spec.serialNumber,
        udiDi: gtin,
        modelId,
        areaId: spec.areaId,
        room: spec.room,
        commissionedAt: spec.commissionedAt,
        responsiblePerson: "Anna Technik",
        responsibleUserId: DEMO.users.anna,
        state: "released",
        releaseLevel: 1,
        productKindCode: chars.produktart,
        source: "wizard",
        characteristicsJson: JSON.stringify(chars),
        maintenanceCycleMonths: spec.maintenanceCycleMonths,
        maintenanceAnchorAt: spec.commissionedAt,
      },
      create: {
        id: instanceId,
        tenantId,
        inventoryNumber: spec.inventoryNumber,
        serialNumber: spec.serialNumber,
        udiDi: gtin,
        modelId,
        areaId: spec.areaId,
        room: spec.room,
        commissionedAt: spec.commissionedAt,
        responsiblePerson: "Anna Technik",
        responsibleUserId: DEMO.users.anna,
        state: "released",
        releaseLevel: 1,
        productKindCode: chars.produktart,
        source: "wizard",
        characteristicsJson: JSON.stringify(chars),
        maintenanceCycleMonths: spec.maintenanceCycleMonths,
        maintenanceAnchorAt: spec.commissionedAt,
      },
    });
    instances += 1;

    await prisma.deviceReleaseSnapshot.create({
      data: {
        id: snapshotId,
        tenantId,
        deviceInstanceId: instanceId,
        releasedBy: "seed",
        ruleSetIds: JSON.stringify(["rs-mpbetreibv"]),
        classificationId: clsId,
        characteristics: JSON.stringify(chars),
        derivedDuties: JSON.stringify(derived),
        prerequisites: JSON.stringify([]),
        appVersion: "golden-seed-1.0",
      },
    });

    for (const duty of derived) {
      await writeDuty(prisma, {
        tenantId,
        deviceInstanceId: instanceId,
        snapshotId,
        duty,
        referenceDate: spec.commissionedAt,
      });
      duties += 1;
    }
  }

  return { models, classifications, instances, duties, exemplars: EXEMPLARS.length };
}
