/**
 * Nachtrag 4 (E85–E91) — flag, RD27 refs/catalogues, demo Betriebsmittel from fixtures.
 * Idempotent. Full fixture demo rows (determinations, Sammelauftrag, …) grow in later phases.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma, type PrismaClient, type ProtectionClass, type StepInputKind } from "@prisma/client";

const DEMO_TENANT_ID = "demo-tenant";
const RULE_SET_ID = "rs-mpbetreibv";
const MSR_ORG_ID = "1f0f2544-0dc8-5869-9c13-85f741e48258";
const AREA_BONN_ICU = "area-bonn-icu";
const K_DGUV_CODE = "K-DGUV";
const FIXTURE_PATH = join(__dirname, "../../fixtures/nachtrag-4/backoffice-v26-5-fixture.json");

const DGUV_AS_OF = "2026-09";
const DGUV_SOURCE = "DIN VDE 0701-0702";

type BetriebsmittelRow = {
  code: string;
  n: string;
  mk: string;
  typ: string;
  sn: string;
  jahr?: number;
  raum?: string;
  resp?: string;
  schutzklasse?: string;
  ortsveraenderlich?: boolean;
  elektrisch?: boolean;
};

const K_DGUV_STEPS: Array<{
  position: number;
  label: string;
  inputKind: StepInputKind;
  isMeasurement?: boolean;
  unit?: string;
  limitText?: string;
  optionsJson?: unknown;
}> = [
  {
    position: 1,
    label: "Sichtprüfung (Gehäuse, Leitung, Stecker, Beschriftung)",
    inputKind: "check",
  },
  {
    position: 2,
    label: "Schutzleiterwiderstand",
    inputKind: "measurement",
    isMeasurement: true,
    unit: "Ω",
    limitText: "≤ 0,3 Ω (SK I)",
    optionsJson: {
      protectionClasses: ["I"],
      reference: true,
      source: DGUV_SOURCE,
      asOf: DGUV_AS_OF,
      limitOhm: 0.3,
    },
  },
  {
    position: 3,
    label: "Isolationswiderstand",
    inputKind: "measurement",
    isMeasurement: true,
    unit: "MΩ",
    limitText: "≥ 1 MΩ (SK I) / ≥ 2 MΩ (SK II)",
    optionsJson: {
      protectionClasses: ["I", "II", "III"],
      reference: true,
      source: DGUV_SOURCE,
      asOf: DGUV_AS_OF,
      limitMohmByClass: { I: 1, II: 2, III: 1 },
    },
  },
  {
    position: 4,
    label: "Schutzleiter-/Berührungsstrom",
    inputKind: "measurement",
    isMeasurement: true,
    unit: "mA",
    limitText: "nach DIN VDE 0701-0702 je Schutzklasse",
    optionsJson: {
      protectionClasses: ["I", "II", "III"],
      reference: true,
      source: DGUV_SOURCE,
      asOf: DGUV_AS_OF,
      limitMaByClass: { I: 3.5, II: 0.5, III: 0.5 },
    },
  },
  {
    position: 5,
    label: "Funktionsprüfung",
    inputKind: "check",
  },
  {
    position: 6,
    label: "Ergebnis und Prüfplakette",
    inputKind: "result",
    optionsJson: {
      requiresLabel: true,
      reference: true,
      source: DGUV_SOURCE,
      asOf: DGUV_AS_OF,
    },
  },
];

function mapProtectionClass(raw: string | undefined): ProtectionClass {
  if (raw === "II" || raw === "III") return raw;
  return "I";
}

export async function seedRadiationDguv(prisma: PrismaClient) {
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
    data: { featureFlags: { ...prev, radiation_dguv: true } },
  });

  await prisma.refProductKind.upsert({
    where: { code: "betriebsmittel" },
    update: {
      label: "Elektrisches Betriebsmittel (kein Medizinprodukt)",
      hint: "DGUV V3 — nicht im § 14 Bestandsverzeichnis",
      sortGroup: "betrieb",
      shows: ["schutzklasse", "ortsveraenderlich", "elektrisch"],
      blocks: ["einstufung", "buch", "export14", "stk", "mtk", "strahlung"],
      presets: {},
    },
    create: {
      code: "betriebsmittel",
      label: "Elektrisches Betriebsmittel (kein Medizinprodukt)",
      hint: "DGUV V3 — nicht im § 14 Bestandsverzeichnis",
      sortGroup: "betrieb",
      shows: ["schutzklasse", "ortsveraenderlich", "elektrisch"],
      blocks: ["einstufung", "buch", "export14", "stk", "mtk", "strahlung"],
      presets: {},
    },
  });

  for (const code of ["STK", "DGUV"] as const) {
    const row = await prisma.refInspectionType.findUnique({ where: { code } });
    if (row) {
      await prisma.refInspectionType.update({
        where: { code },
        data: { requiresLabel: true },
      });
    }
  }

  await prisma.refQualification.upsert({
    where: { code: "befaehigte_person_elektro" },
    update: {
      label: "Befähigte Person (elektro) nach TRBS 1203 / DGUV V3",
      legalBasis: "DGUV Vorschrift 3 · TRBS 1203",
      ruleSetId: RULE_SET_ID,
    },
    create: {
      code: "befaehigte_person_elektro",
      label: "Befähigte Person (elektro) nach TRBS 1203 / DGUV V3",
      legalBasis: "DGUV Vorschrift 3 · TRBS 1203",
      ruleSetId: RULE_SET_ID,
    },
  });

  for (const cls of [
    { code: "sicherheitstester", label: "Sicherheitstester (DIN VDE 0701-0702 / EN 62353)" },
    { code: "pruefkoerper_roentgen", label: "Röntgen-Prüfkörper (DIN 6868)" },
    { code: "leuchtdichtemessgeraet", label: "Leuchtdichtemessgerät (DIN 6868-157)" },
  ] as const) {
    await prisma.refTestEquipmentClass.upsert({
      where: { code: cls.code },
      update: { label: cls.label },
      create: { code: cls.code, label: cls.label },
    });
  }

  // K-DGUV catalogue
  await prisma.refInspectionCatalogue.upsert({
    where: { ruleSetId_code: { ruleSetId: RULE_SET_ID, code: K_DGUV_CODE } },
    update: {
      inspectionTypeCode: "DGUV",
      scope: "generic",
      scopeValue: null,
      label: "Prüfung elektrischer Betriebsmittel nach DGUV Vorschrift 3 (K-DGUV)",
      legalBasis: "ArbSchG · BetrSichV · DGUV Vorschrift 3",
      retention: "mindestens bis zur nächsten Prüfung",
      testEquipmentClass: "sicherheitstester",
      draft: false,
      noCatalogue: false,
      note: "Referenz — gegen aktuelle Norm prüfen. Bei MP mit STK entscheidet der Betreiber über Abdeckung.",
    },
    create: {
      id: `cat-${K_DGUV_CODE}`,
      ruleSetId: RULE_SET_ID,
      code: K_DGUV_CODE,
      inspectionTypeCode: "DGUV",
      scope: "generic",
      label: "Prüfung elektrischer Betriebsmittel nach DGUV Vorschrift 3 (K-DGUV)",
      legalBasis: "ArbSchG · BetrSichV · DGUV Vorschrift 3",
      retention: "mindestens bis zur nächsten Prüfung",
      testEquipmentClass: "sicherheitstester",
      note: "Referenz — gegen aktuelle Norm prüfen. Bei MP mit STK entscheidet der Betreiber über Abdeckung.",
    },
  });

  const savedCat = await prisma.refInspectionCatalogue.findUnique({
    where: { ruleSetId_code: { ruleSetId: RULE_SET_ID, code: K_DGUV_CODE } },
    select: { id: true },
  });
  if (!savedCat) throw new Error("K-DGUV catalogue missing after upsert");

  for (const step of K_DGUV_STEPS) {
    await prisma.refInspectionStep.upsert({
      where: { catalogueId_position: { catalogueId: savedCat.id, position: step.position } },
      update: {
        label: step.label,
        isMeasurement: Boolean(step.isMeasurement),
        inputKind: step.inputKind,
        unit: step.unit ?? null,
        limitText: step.limitText ?? null,
        limitSource: step.limitText ? "standard" : null,
        optionsJson: step.optionsJson ?? undefined,
      },
      create: {
        id: `step-${K_DGUV_CODE}-${step.position}`,
        catalogueId: savedCat.id,
        position: step.position,
        label: step.label,
        isMeasurement: Boolean(step.isMeasurement),
        inputKind: step.inputKind,
        unit: step.unit ?? null,
        limitText: step.limitText ?? null,
        limitSource: step.limitText ? "standard" : null,
        optionsJson: step.optionsJson ?? undefined,
      },
    });
  }

  await prisma.refQualificationRule.upsert({
    where: {
      inspectionTypeCode_qualificationCode: {
        inspectionTypeCode: "DGUV",
        qualificationCode: "befaehigte_person_elektro",
      },
    },
    update: {},
    create: {
      inspectionTypeCode: "DGUV",
      qualificationCode: "befaehigte_person_elektro",
    },
  });

  await prisma.refCatalogueQualification.upsert({
    where: {
      catalogueId_qualificationCode: {
        catalogueId: savedCat.id,
        qualificationCode: "befaehigte_person_elektro",
      },
    },
    update: {},
    create: {
      catalogueId: savedCat.id,
      qualificationCode: "befaehigte_person_elektro",
    },
  });

  // Service-type gates for MSR (safe defaults)
  const msr = await prisma.organisation.findUnique({ where: { id: MSR_ORG_ID } });
  if (msr) {
    const gates: Array<{
      serviceType: string;
      qualificationCode: string;
      overridableBy: "none" | "service_lead" | "management";
      locked: boolean;
    }> = [
      {
        serviceType: "sv",
        qualificationCode: "sachverstaendiger",
        overridableBy: "none",
        locked: true,
      },
      {
        serviceType: "konstanz",
        qualificationCode: "fachkunde_strlsch",
        overridableBy: "service_lead",
        locked: false,
      },
      {
        serviceType: "dguv",
        qualificationCode: "befaehigte_person_elektro",
        overridableBy: "management",
        locked: false,
      },
    ];
    for (const g of gates) {
      await prisma.serviceTypeGate.upsert({
        where: {
          organisationId_serviceType: {
            organisationId: MSR_ORG_ID,
            serviceType: g.serviceType,
          },
        },
        update: {
          qualificationCode: g.qualificationCode,
          gate: "block",
          overridableBy: g.overridableBy,
          locked: g.locked,
          setBy: "seed",
        },
        create: {
          id: `stg-msr-${g.serviceType}`,
          organisationId: MSR_ORG_ID,
          serviceType: g.serviceType,
          qualificationCode: g.qualificationCode,
          gate: "block",
          overridableBy: g.overridableBy,
          locked: g.locked,
          setBy: "seed",
        },
      });
    }
  }

  // Demo Betriebsmittel from full backoffice fixture (console may add BM-0006/0007 later)
  let equipmentCreated = 0;
  try {
    const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as {
      betriebsmittel?: BetriebsmittelRow[];
    };
    const rows = fixture.betriebsmittel ?? [];
    const area = await prisma.area.findUnique({ where: { id: AREA_BONN_ICU } });
    for (const bm of rows) {
      const id = `instance-equip-${bm.code.toLowerCase()}`;
      const inventoryNumber = bm.code;
      await prisma.deviceInstance.upsert({
        where: { id },
        update: {
          kind: "equipment",
          productKindCode: "betriebsmittel",
          serialNumber: bm.sn || null,
          room: bm.raum ?? null,
          responsiblePerson: bm.resp ?? null,
          protectionClass: mapProtectionClass(bm.schutzklasse),
          portable: Boolean(bm.ortsveraenderlich),
          electrical: bm.elektrisch !== false,
          state: "released",
          characteristicsJson: JSON.stringify({
            tradeName: bm.n,
            manufacturer: bm.mk,
            modelName: bm.typ,
            year: bm.jahr ?? null,
          }),
        },
        create: {
          id,
          tenantId: DEMO_TENANT_ID,
          inventoryNumber,
          serialNumber: bm.sn || null,
          modelId: null,
          areaId: area?.id ?? null,
          room: bm.raum ?? null,
          responsiblePerson: bm.resp ?? "seed",
          state: "released",
          kind: "equipment",
          productKindCode: "betriebsmittel",
          protectionClass: mapProtectionClass(bm.schutzklasse),
          portable: Boolean(bm.ortsveraenderlich),
          electrical: bm.elektrisch !== false,
          source: "manual",
          characteristicsJson: JSON.stringify({
            tradeName: bm.n,
            manufacturer: bm.mk,
            modelName: bm.typ,
            year: bm.jahr ?? null,
          }),
        },
      });
      equipmentCreated += 1;

      // Open DGUV duty without determination (tile dguv-ohne-festlegung)
      const dutyId = `duty-equip-${bm.code.toLowerCase()}-dguv`;
      const existingDuty = await prisma.deviceDuty.findFirst({
        where: { deviceInstanceId: id, dutyKey: "dguv", suspendedAt: null },
      });
      if (!existingDuty) {
        // Need a release snapshot for DeviceDuty.snapshotId — create a minimal one if absent
        let snap = await prisma.deviceReleaseSnapshot.findFirst({
          where: { deviceInstanceId: id },
          orderBy: { releasedAt: "desc" },
        });
        if (!snap) {
          snap = await prisma.deviceReleaseSnapshot.create({
            data: {
              id: `snap-equip-${bm.code.toLowerCase()}`,
              tenantId: DEMO_TENANT_ID,
              deviceInstanceId: id,
              releasedAt: new Date("2026-09-01"),
              releasedBy: "seed",
              ruleSetIds: JSON.stringify([RULE_SET_ID]),
              characteristics: JSON.stringify({ kind: "equipment" }),
              derivedDuties: JSON.stringify([{ id: "dguv" }]),
              prerequisites: JSON.stringify([]),
              appVersion: "seed-radiation-dguv",
            },
          });
        }
        await prisma.deviceDuty.create({
          data: {
            id: dutyId,
            tenantId: DEMO_TENANT_ID,
            deviceInstanceId: id,
            snapshotId: snap.id,
            dutyKey: "dguv",
            inspectionTypeCode: "DGUV",
            deadlineAnchor: "interval",
            basisText:
              "ArbSchG · BetrSichV · DGUV Vorschrift 3 — Intervall aus der Gefährdungsbeurteilung festzulegen",
            confidence: "determination",
            applicable: true,
            referenceDate: new Date("2026-09-01"),
            dueAt: null,
            title: "Electrical equipment inspection (DGUV V3)",
            category: "inspection",
            determinationState: null,
          },
        });
      }
    }
  } catch (e) {
    console.warn("[seedRadiationDguv] equipment fixture skipped:", e);
  }

  const cadencePatched = await patchConstancyCadenceCapture(prisma);

  return {
    flag: true,
    catalogue: K_DGUV_CODE,
    equipment: equipmentCreated,
    gates: msr ? 3 : 0,
    cadencePatched,
  };
}

type CapturePatch = {
  captureMode: "device_protocol" | "manual_measurement" | "visual";
  protocolSource: string | null;
  referenceValuesJson: unknown;
};

const QS = "QS-RL Röntgendiagnostik / DIN 6868-Reihe";

/** Align open ConstancyCadence rows with QS-RL / mockup Erfassungsweg A|B|C. */
function capturePatchForObject(code: string): CapturePatch {
  switch (code) {
    case "aufnahme":
      return {
        captureMode: "device_protocol",
        protocolSource: "Herstellersoftware Radiotec QC-Suite",
        referenceValuesJson: null,
      };
    case "durchl":
      return {
        captureMode: "device_protocol",
        protocolSource: "Herstellersoftware",
        referenceValuesJson: null,
      };
    case "monitor":
      return {
        captureMode: "visual",
        protocolSource: null,
        referenceValuesJson: {
          visualCheckpoints: [
            "Testbild TG18-QC: alle Graustufenfelder unterscheidbar",
            "Keine Artefakte, Pixelfehler oder Nachleuchten",
            "Umgebungsbeleuchtung wie festgelegt (abgedunkelt)",
          ],
        },
      };
    case "digital":
      return {
        captureMode: "visual",
        protocolSource: null,
        referenceValuesJson: {
          visualCheckpoints: [
            "Prüfkörperaufnahme ohne Artefakte",
            "Dosisindikator im Referenzbereich",
            "Bildbezeichnung und Seitenkennung korrekt",
          ],
        },
      };
    case "dosis":
      return {
        captureMode: "manual_measurement",
        protocolSource: null,
        referenceValuesJson: [
          {
            name: "DFP Anzeige/Referenz",
            value: 100,
            unit: "%",
            tolerancePct: 25,
            source: QS,
            asOf: "2026-11",
          },
        ],
      };
    default:
      return {
        captureMode: "device_protocol",
        protocolSource: null,
        referenceValuesJson: null,
      };
  }
}

async function patchConstancyCadenceCapture(prisma: PrismaClient): Promise<number> {
  const rows = await prisma.constancyCadence.findMany({
    where: { validTo: null },
    select: { id: true, constancyObjectCode: true },
  });
  let n = 0;
  for (const row of rows) {
    const patch = capturePatchForObject(row.constancyObjectCode);
    await prisma.constancyCadence.update({
      where: { id: row.id },
      data: {
        captureMode: patch.captureMode,
        protocolSource: patch.protocolSource,
        referenceValuesJson:
          patch.referenceValuesJson === null
            ? Prisma.JsonNull
            : (patch.referenceValuesJson as Prisma.InputJsonValue),
      },
    });
    n += 1;
  }
  return n;
}
