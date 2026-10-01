/**
 * Run deriveDuties against fixtures/pflichten/pflichten-erwartung-schema.json
 * and write ableitung.json for vergleich_pflichten.py.
 *
 * Usage:
 *   npx tsx scripts/runPflichtenFixture.ts
 *   python3 fixtures/pflichten/vergleich_pflichten.py \
 *     --erwartung fixtures/pflichten/pflichten-erwartung.json \
 *     --live fixtures/pflichten/ableitung.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { deriveDuties } from "../src/services/registration/deriveDuties";
import type {
  DerivedDuty,
  RegistrationCharacteristics,
} from "../src/services/registration/types";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = join(root, "fixtures", "pflichten");

/** Same mapping as vergleich_pflichten.py DUTY_KEY (+ live id variants). */
const DUTY_KEY: Record<string, string> = {
  wartung: "wartung",
  stk: "stk",
  "stk-medgv": "stk-medgv",
  mtk: "mtk",
  abnahme: "abnahme",
  konstanz: "konstanz",
  sv: "sv",
  aerztl: "aerztl",
  nuklear: "nuklear",
  itsec: "itsec",
  install: "install",
  aufb: "aufbereitung",
  "aufb-extern": "kontrolle",
  "eigen-val": "validierung",
  einmal: "einmalprodukt",
  zub: "zubehoer",
  netz: "vernetzung",
  impl: "implantat",
};

const ANNEX2: Record<
  string,
  {
    label: string;
    intervalYears: number | null;
    isGroup: boolean;
    confidence?: "verified" | "derived";
  }
> = {
  "1.1": { label: "Audiometer", intervalYears: 1, isGroup: false, confidence: "verified" },
  "1.2.1": { label: "Elektrothermometer", intervalYears: 2, isGroup: false, confidence: "derived" },
  "1.2.2": { label: "Elektrothermometer Wechselfühler", intervalYears: 2, isGroup: false, confidence: "derived" },
  "1.2.3": { label: "Infrarot-Thermometer", intervalYears: 1, isGroup: false, confidence: "verified" },
  "1.3": { label: "NIBP", intervalYears: 2, isGroup: false, confidence: "verified" },
  "1.4.1": { label: "Augentonometer", intervalYears: 2, isGroup: false, confidence: "derived" },
  "1.4.2": { label: "Augentonometer Grenzwert", intervalYears: 5, isGroup: false, confidence: "derived" },
  "1.5.1": { label: "Therapy dose", intervalYears: 2, isGroup: false, confidence: "derived" },
  "1.5.2": { label: "Therapy dose (alt)", intervalYears: 2, isGroup: false, confidence: "derived" },
  "1.5.3": { label: "Co-60", intervalYears: null, isGroup: false, confidence: "derived" },
  "1.6": { label: "Diagnostikdosimeter", intervalYears: 5, isGroup: false, confidence: "derived" },
  "1.7": { label: "Tretkurbelergometer", intervalYears: 2, isGroup: false, confidence: "verified" },
};

const RADIATION: Record<string, { qualityGuideline: string; expertInspectionApplies: boolean }> = {
  roentgen: { qualityGuideline: "QS-RL Röntgendiagnostik", expertInspectionApplies: true },
  therapie: { qualityGuideline: "QS-RL Strahlentherapie", expertInspectionApplies: true },
  nuklear: { qualityGuideline: "QS-RL Nuklearmedizin", expertInspectionApplies: false },
};

const REQUIRES_VALIDATED: Record<string, boolean> = {
  unkritisch: false,
  "semikritisch-a": true,
  "semikritisch-b": true,
  "kritisch-a": true,
  "kritisch-b": true,
  "kritisch-c": true,
};

const CONFIDENCE: Record<string, string> = {
  verified: "verified",
  responsible: "responsible",
  determination: "determination",
  derived: "derived",
  guess: "guess",
  "n/a": "not_applicable",
  not_applicable: "not_applicable",
};

const ANCHOR: Record<string, string> = {
  tag: "exact_day",
  monatsende: "month_end",
  jahresende: "year_end",
  ereignis: "event",
  intervall: "interval",
  prozess: "process",
  dauerhaft: "permanent",
  verweis: "reference",
  referenz: "reference",
  entfaellt: "none",
  exact_day: "exact_day",
  month_end: "month_end",
  year_end: "year_end",
  event: "event",
  interval: "interval",
  process: "process",
  permanent: "permanent",
  reference: "reference",
  none: "none",
};

const UNIT: Record<string, string> = {
  Monate: "months",
  Jahre: "years",
  Tage: "days",
  months: "months",
  years: "years",
  days: "days",
};

interface SchemaCase {
  fall: string;
  merkmale: RegistrationCharacteristics;
  releaseLevel?: number;
}

function mapDutyKey(id: string): string {
  if (DUTY_KEY[id]) return DUTY_KEY[id];
  if (id.startsWith("val-ref-") || id.startsWith("valref-")) return "validierung-verweis";
  const stem = id.split("-")[0] ?? id;
  return DUTY_KEY[stem] ?? id;
}

function toLiveDuty(d: DerivedDuty) {
  const applicable = Boolean(d.einschlaegig);
  const confidence = CONFIDENCE[d.vertrauen] ?? d.vertrauen;
  const deadlineAnchor = ANCHOR[d.deadlineAnchor] ?? ANCHOR[d.bezug] ?? d.deadlineAnchor;
  const intervalUnit = d.einheit == null ? null : (UNIT[d.einheit] ?? d.einheit);

  return {
    dutyKey: mapDutyKey(d.id),
    quelleId: d.id,
    category: d.category ?? "inspection",
    applicable,
    deadlineAnchor,
    intervalValue: d.frist,
    intervalUnit,
    cadenceLabel: d.intervall ?? null,
    confidence,
    setsBaseline: Boolean(d.setsBaseline),
    requiresBaseline: Boolean(d.requiresBaseline),
    hasReferenceDevice: Boolean(d.referenceDeviceId),
    referenceDeviceId: d.referenceDeviceId ?? null,
    basisText: d.grund,
  };
}

function annex2For(m: RegistrationCharacteristics) {
  const itemNo = m.anlage2Ziffer ?? m.anlage2ItemId;
  if (!itemNo) return null;
  const row = ANNEX2[itemNo];
  if (!row) {
    return { itemNo, label: itemNo, intervalYears: null, isGroup: false };
  }
  return { itemNo, ...row };
}

function radiationFor(m: RegistrationCharacteristics) {
  if (!m.strahlung) return null;
  const code = m.strahlenArt ?? "roentgen";
  const row = RADIATION[code];
  if (!row) {
    return { code, qualityGuideline: null, expertInspectionApplies: code !== "nuklear" };
  }
  return { code, ...row };
}

function linkedEquipmentIds(m: RegistrationCharacteristics): string[] {
  // Fixture uses INV-2025-0120 for valref-rdg; comparison only checks hasReferenceDevice.
  if ((m.aufbGeraete?.length ?? 0) > 0 && !m.istAufbGeraet) {
    return ["INV-2025-0120"];
  }
  return [];
}

function main() {
  const schemaPath = join(fixtureDir, "pflichten-erwartung-schema.json");
  const outPath = join(fixtureDir, "ableitung.json");
  const raw = JSON.parse(readFileSync(schemaPath, "utf8")) as { faelle: SchemaCase[] };

  const ableitung = raw.faelle.map((c) => {
    const m = c.merkmale;
    const duties = deriveDuties({
      characteristics: m,
      annex2: annex2For(m),
      radiationRef: radiationFor(m),
      linkedEquipmentDeviceIds: linkedEquipmentIds(m),
      requiresValidatedProcess: REQUIRES_VALIDATED[m.aufbKlasse ?? ""] ?? true,
    });
    return {
      fall: c.fall,
      duties: duties.map(toLiveDuty),
    };
  });

  writeFileSync(outPath, JSON.stringify(ableitung, null, 1) + "\n", "utf8");
  const dutyCount = ableitung.reduce((n, f) => n + f.duties.length, 0);
  console.log(`Wrote ${ableitung.length} cases, ${dutyCount} duties → ${outPath}`);
}

main();
