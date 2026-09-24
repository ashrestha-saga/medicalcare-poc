/**
 * Regulatory reference seed for Erstanlage (from handover stammdaten).
 * Source: 04-stammdaten/devicecare-seed.sql + mtk-anlage2-regeln.json
 */
import type { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RULE_SETS = [
  {
    id: "rs-mpbetreibv",
    code: "MPBETREIBV",
    title: "Medizinprodukte-Betreiberverordnung",
    legalBasis: "MPBetreibV",
    versionLabel: "2025-02",
    validFrom: new Date("2025-02-20"),
    sourceNote: "Fassung vom 14.02.2025, in Kraft seit 20.02.2025",
  },
  {
    id: "rs-annex2",
    code: "MPBETREIBV_ANNEX2",
    title: "Anlage 2 MPBetreibV",
    legalBasis: "Anlage 2 MPBetreibV",
    versionLabel: "2025-02",
    validFrom: new Date("2025-02-20"),
    sourceNote: "Zu § 4 Absatz 8, § 13 Absatz 1 und § 15 Absatz 1",
  },
  {
    id: "rs-strlschv",
    code: "STRLSCHV",
    title: "Strahlenschutzverordnung",
    legalBasis: "StrlSchV",
    versionLabel: "2018-12",
    validFrom: new Date("2018-12-31"),
    sourceNote: null as string | null,
  },
  {
    id: "rs-krinko",
    code: "KRINKO_BFARM",
    title: "KRINKO/BfArM-Empfehlung zur Aufbereitung",
    legalBasis: "KRINKO/BfArM",
    versionLabel: "2012",
    validFrom: new Date("2012-10-01"),
    sourceNote: null,
  },
  {
    id: "rs-normen",
    code: "NORMEN",
    title: "Technische Normen und Leitlinien",
    legalBasis: "DIN/EN/ISO",
    versionLabel: "2026-09",
    validFrom: new Date("2026-09-01"),
    sourceNote: "Normenstand ist vor der Anwendung zu pruefen",
  },
] as const;

const INSPECTION_TYPES: {
  code: string;
  ruleSetId: string;
  label: string;
  legalBasis: string;
  deadlineAnchor: string;
  defaultInterval: number | null;
  intervalUnit: string | null;
  evidenceHint: string;
}[] = [
  {
    code: "MAINT",
    ruleSetId: "rs-mpbetreibv",
    label: "Instandhaltung",
    legalBasis: "§ 7 MPBetreibV",
    deadlineAnchor: "exact_day",
    defaultInterval: null,
    intervalUnit: null,
    evidenceHint: "Wartungsbericht, bei Anlage-1-Produkten Eintrag im Medizinproduktebuch",
  },
  {
    code: "STK",
    ruleSetId: "rs-mpbetreibv",
    label: "Sicherheitstechnische Kontrolle",
    legalBasis: "§ 12 MPBetreibV",
    deadlineAnchor: "month_end",
    defaultInterval: 24,
    intervalUnit: "months",
    evidenceHint: "Protokoll, Eintrag im Medizinproduktebuch, Kennzeichnung am Produkt",
  },
  {
    code: "MTK",
    ruleSetId: "rs-annex2",
    label: "Messtechnische Kontrolle",
    legalBasis: "§ 15 MPBetreibV",
    deadlineAnchor: "year_end",
    defaultInterval: null,
    intervalUnit: null,
    evidenceHint: "Protokoll, Aufbewahrung bis zur naechsten MTK",
  },
  {
    code: "ACCEPT",
    ruleSetId: "rs-strlschv",
    label: "Abnahmepruefung",
    legalBasis: "§ 115 StrlSchV",
    deadlineAnchor: "event",
    defaultInterval: null,
    intervalUnit: null,
    evidenceHint: "Pruefbericht mit Bezugswerten",
  },
  {
    code: "CONSTANCY",
    ruleSetId: "rs-strlschv",
    label: "Konstanzpruefung",
    legalBasis: "§ 116 StrlSchV",
    deadlineAnchor: "interval",
    defaultInterval: null,
    intervalUnit: null,
    evidenceHint: "Aufzeichnung nach § 117 StrlSchV, mindestens zehn Jahre",
  },
  {
    code: "EXPERT",
    ruleSetId: "rs-strlschv",
    label: "Sachverstaendigenpruefung",
    legalBasis: "§ 88 Absatz 4 Nummer 1 StrlSchV",
    deadlineAnchor: "year_end",
    defaultInterval: 5,
    intervalUnit: "years",
    evidenceHint: "Bescheinigung des behoerdlich bestimmten Sachverstaendigen",
  },
  {
    code: "MEDBOARD",
    ruleSetId: "rs-strlschv",
    label: "Pruefung durch die aerztliche Stelle",
    legalBasis: "§§ 128, 130 StrlSchV",
    deadlineAnchor: "interval",
    defaultInterval: null,
    intervalUnit: null,
    evidenceHint: "Angeforderte Aufnahmen und Aufzeichnungen",
  },
  {
    code: "ITSEC",
    ruleSetId: "rs-mpbetreibv",
    label: "IT-Sicherheitsueberpruefung",
    legalBasis: "§ 17 MPBetreibV",
    deadlineAnchor: "month_end",
    defaultInterval: 24,
    intervalUnit: "months",
    evidenceHint: "Protokoll mit Datum und Ergebnis",
  },
  {
    code: "INSTALL",
    ruleSetId: "rs-mpbetreibv",
    label: "Installationspruefung",
    legalBasis: "§ 17 MPBetreibV",
    deadlineAnchor: "event",
    defaultInterval: null,
    intervalUnit: null,
    evidenceHint: "Pruefnachweis vor Inbetriebnahme",
  },
  {
    code: "REPROC",
    ruleSetId: "rs-krinko",
    label: "Aufbereitung",
    legalBasis: "§ 8 MPBetreibV",
    deadlineAnchor: "process",
    defaultInterval: null,
    intervalUnit: null,
    evidenceHint: "Validierungsbericht, Freigabeprotokolle je Charge",
  },
  {
    code: "REPROC_CTRL",
    ruleSetId: "rs-mpbetreibv",
    label: "Kontrolle der beauftragten Aufbereitung",
    legalBasis: "§ 8 MPBetreibV",
    deadlineAnchor: "year_end",
    defaultInterval: 12,
    intervalUnit: "months",
    evidenceHint: "Dokumentation der eigenen Kontrolle",
  },
  {
    code: "VALIDATION",
    ruleSetId: "rs-normen",
    label: "Validierung eines Aufbereitungsprozesses",
    legalBasis: "§ 8 MPBetreibV",
    deadlineAnchor: "year_end",
    defaultInterval: 12,
    intervalUnit: "months",
    evidenceHint: "Validierungsbericht mit IQ, BQ und LQ",
  },
  {
    code: "SINGLE_USE",
    ruleSetId: "rs-mpbetreibv",
    label: "Aufbereitung von Einmalprodukten",
    legalBasis: "§ 9 MPBetreibV",
    deadlineAnchor: "process",
    defaultInterval: null,
    intervalUnit: null,
    evidenceHint: "Nachweis der Eignung des Verfahrens",
  },
  {
    code: "NETWORK",
    ruleSetId: "rs-mpbetreibv",
    label: "Anforderungen fuer vernetzte Produkte",
    legalBasis: "§ 4 Absatz 6 MPBetreibV",
    deadlineAnchor: "permanent",
    defaultInterval: null,
    intervalUnit: null,
    evidenceHint: "Dokumentierte Netzanbindung",
  },
  {
    code: "IMPLANT",
    ruleSetId: "rs-mpbetreibv",
    label: "Dokumentation ueber Implantate",
    legalBasis: "§ 16 MPBetreibV",
    deadlineAnchor: "event",
    defaultInterval: null,
    intervalUnit: null,
    evidenceHint: "Dokumentation je Implantation",
  },
  {
    code: "RADIOACTIVE",
    ruleSetId: "rs-strlschv",
    label: "Umgang mit radioaktiven Stoffen",
    legalBasis: "StrlSchG, StrlSchV",
    deadlineAnchor: "permanent",
    defaultInterval: null,
    intervalUnit: null,
    evidenceHint: "Kontaminationsmessungen, Buchfuehrung ueber den Verbleib",
  },
];

/** FA-219 — mirrors v17 PRODUKTARTEN (shows / blocks / presets). Exported for matrix tests. */
export const PRODUCT_KINDS = [
  {
    code: "bildgebung",
    label: "Bildgebung mit ionisierender Strahlung",
    hint: "Röntgen, Angiografie, CT, Mammografie",
    sortGroup: "Bildgebung und Strahlung",
    shows: ["stk", "strahlung", "software", "vernetzt", "wartung"],
    blocks: ["implantat", "einmal", "eigenAufb"],
    presets: { aktiv: true, strahlung: true, strahlenArt: "roentgen", vernetzt: true },
  },
  {
    code: "therapie-strahlen",
    label: "Strahlentherapie",
    hint: "Beschleuniger, Bestrahlungsvorrichtungen",
    sortGroup: "Bildgebung und Strahlung",
    // No MTK: Anlage 2 Nr. 1.5 is the dosimeter, not the accelerator.
    shows: ["stk", "strahlung", "software", "vernetzt", "wartung"],
    blocks: ["implantat", "einmal", "eigenAufb"],
    presets: { aktiv: true, strahlung: true, strahlenArt: "therapie", vernetzt: true },
  },
  {
    code: "nuklear",
    label: "Nuklearmedizin",
    hint: "Gammakamera, PET, Umgang mit radioaktiven Stoffen",
    sortGroup: "Bildgebung und Strahlung",
    shows: ["stk", "strahlung", "software", "vernetzt", "wartung"],
    blocks: ["implantat", "einmal", "eigenAufb"],
    presets: { aktiv: true, strahlung: true, strahlenArt: "nuklear", vernetzt: true },
  },
  {
    code: "sonografie",
    label: "Sonografie und bildgebender Ultraschall",
    hint: "Ultraschallsysteme mit Schallköpfen",
    sortGroup: "Aktive Geräte und Messtechnik",
    shows: ["stk", "aufbereitung", "zubehoer", "software", "vernetzt", "wartung"],
    blocks: ["strahlung", "implantat", "einmal", "eigenAufb"],
    presets: { aktiv: true, aufbereitung: true, vernetzt: true },
  },
  {
    code: "aktiv-therapie",
    label: "Aktives Therapie- oder Funktionsgerät",
    hint: "Beatmung, Infusion, HF-Chirurgie, Defibrillation, Dialyse",
    sortGroup: "Aktive Geräte und Messtechnik",
    // No MTK (not in Anlage 2); Aufbereitung for reusable accessories.
    shows: ["stk", "aufbereitung", "software", "vernetzt", "wartung"],
    blocks: ["implantat", "einmal", "eigenAufb"],
    presets: { aktiv: true, anlage1: true },
  },
  {
    code: "messgeraet",
    label: "Messgerät mit Messfunktion",
    hint: "Blutdruck, Thermometer, Tonometer, Ergometer, Dosimeter",
    sortGroup: "Aktive Geräte und Messtechnik",
    shows: ["mtk", "stk", "vernetzt", "wartung", "aufbereitung"],
    // Locked even under "Weitere Merkmale" — Aufbereitung stays reachable.
    blocks: ["strahlung", "eigenAufb", "implantat", "einmal"],
    // No aktiv preset: mechanical BP (Aneroid) is not active but still MTK-pflichtig.
    presets: {},
  },
  {
    code: "aufbereitungsgeraet",
    label: "Aufbereitungsgerät",
    hint: "Thermodesinfektor, Autoklav, Folienschweißgerät",
    sortGroup: "Aufbereitung, Instrumente, Software",
    shows: ["eigenAufb", "stk", "vernetzt", "wartung"],
    // Block aufbereitung so the device cannot also be the product being reprocessed.
    blocks: ["strahlung", "implantat", "einmal", "aufbereitung"],
    presets: { aktiv: true, istAufbGeraet: true },
  },
  {
    code: "instrument",
    label: "Wiederverwendbares Instrument oder Zubehör",
    hint: "Instrumentensets, Endoskope, Sonden",
    sortGroup: "Aufbereitung, Instrumente, Software",
    shows: ["aufbereitung", "aufbgeraet", "zubehoer", "einmal"],
    blocks: ["strahlung", "software", "implantat", "vernetzt", "mtk", "eigenAufb"],
    presets: { aufbereitung: true },
  },
  {
    code: "software",
    label: "Software als eigenständiges Produkt",
    hint: "Befundungssoftware, SaMD, SaIVD",
    sortGroup: "Aufbereitung, Instrumente, Software",
    shows: ["software", "vernetzt"],
    blocks: ["stk", "strahlung", "aufbereitung", "implantat", "mtk", "eigenAufb", "einmal"],
    presets: { software: true, vernetzt: true },
  },
  {
    code: "implantat",
    label: "Implantat nach Anlage 3",
    hint: "Implantierbare Produkte mit Dokumentationspflicht",
    sortGroup: "Aufbereitung, Instrumente, Software",
    shows: ["implantat"],
    blocks: ["stk", "strahlung", "aufbereitung", "software", "mtk", "vernetzt", "eigenAufb", "einmal"],
    presets: { implantat: true },
  },
  {
    code: "sonstiges",
    label: "Sonstiges Produkt",
    hint: "Alle Merkmale einzeln wählbar",
    sortGroup: "Aufbereitung, Instrumente, Software",
    shows: [
      "stk",
      "mtk",
      "strahlung",
      "software",
      "aufbereitung",
      "aufbgeraet",
      "zubehoer",
      "einmal",
      "vernetzt",
      "implantat",
      "wartung",
      "eigenAufb",
    ],
    blocks: [] as string[],
    presets: {},
  },
] as const;

type Annex2Json = {
  regeln: {
    id: string;
    ziffer: string;
    parent?: string;
    ebene: string;
    bezeichnung: string;
    einschraenkung?: string;
    bedingung?: string;
    fristJahre: number | null;
    matchTerms?: string[];
    matchExclude?: string[];
    matchConfidence?: string;
    variante?: string;
  }[];
};

function loadAnnex2(): Annex2Json {
  const path = join(process.cwd(), "data", "mtk-anlage2-regeln.json");
  return JSON.parse(readFileSync(path, "utf8")) as Annex2Json;
}

export async function seedRegistrationRef(prisma: PrismaClient): Promise<void> {
  for (const rs of RULE_SETS) {
    await prisma.refRuleSet.upsert({
      where: { id: rs.id },
      update: {
        code: rs.code,
        title: rs.title,
        legalBasis: rs.legalBasis,
        versionLabel: rs.versionLabel,
        validFrom: rs.validFrom,
        sourceNote: rs.sourceNote,
      },
      create: { ...rs },
    });
  }

  for (const it of INSPECTION_TYPES) {
    await prisma.refInspectionType.upsert({
      where: { code: it.code },
      update: {
        ruleSetId: it.ruleSetId,
        label: it.label,
        legalBasis: it.legalBasis,
        deadlineAnchor: it.deadlineAnchor,
        defaultInterval: it.defaultInterval,
        intervalUnit: it.intervalUnit,
        evidenceHint: it.evidenceHint,
      },
      create: it,
    });
  }

  const annex2 = loadAnnex2();
  for (const r of annex2.regeln) {
    const id = `annex2-${r.id}`;
    const isGroup = r.ebene === "gruppe";
    await prisma.refAnnex2Item.upsert({
      where: { id },
      update: {
        ruleSetId: "rs-annex2",
        itemNo: r.ziffer,
        parentItemNo: r.parent ?? null,
        label: r.variante ? `${r.bezeichnung} (${r.variante})` : r.bezeichnung,
        restriction: r.einschraenkung ?? null,
        isGroup,
        intervalYears: r.fristJahre,
        conditionText: r.bedingung ?? null,
        matchTerms: JSON.stringify(r.matchTerms ?? []),
        matchExclude: JSON.stringify(r.matchExclude ?? []),
        matchConfidence: r.matchConfidence === "kuratiert" ? "derived" : (r.matchConfidence ?? "derived"),
      },
      create: {
        id,
        ruleSetId: "rs-annex2",
        itemNo: r.ziffer,
        parentItemNo: r.parent ?? null,
        label: r.variante ? `${r.bezeichnung} (${r.variante})` : r.bezeichnung,
        restriction: r.einschraenkung ?? null,
        isGroup,
        intervalYears: r.fristJahre,
        conditionText: r.bedingung ?? null,
        matchTerms: JSON.stringify(r.matchTerms ?? []),
        matchExclude: JSON.stringify(r.matchExclude ?? []),
        matchConfidence: r.matchConfidence === "kuratiert" ? "derived" : (r.matchConfidence ?? "derived"),
      },
    });
  }

  const reproc = [
    { code: "unkritisch", label: "Unkritisch — Kontakt nur mit intakter Haut", requiresQmsCert: false, note: "Reinigung und ggf. Desinfektion nach schriftlicher Arbeitsanweisung." },
    { code: "semikritisch-a", label: "Semikritisch A — Kontakt mit Schleimhaut, ohne besondere Anforderungen", requiresQmsCert: false, note: "Validierte Reinigung und Desinfektion." },
    { code: "semikritisch-b", label: "Semikritisch B — Kontakt mit Schleimhaut, mit besonderen Anforderungen", requiresQmsCert: false, note: "Validierte maschinelle Aufbereitung empfohlen." },
    { code: "kritisch-a", label: "Kritisch A — Durchdringt Haut oder Schleimhaut, ohne besondere Anforderungen", requiresQmsCert: false, note: "Validierte Reinigung, Desinfektion und Sterilisation." },
    { code: "kritisch-b", label: "Kritisch B — mit besonderen Anforderungen an die Aufbereitung", requiresQmsCert: true, note: "Zertifizierung des Qualitätsmanagementsystems durch eine benannte Stelle." },
    { code: "kritisch-c", label: "Kritisch C — mit besonders hohen Anforderungen", requiresQmsCert: true, note: "Wie kritisch B, zusätzlich besonders hohe Anforderungen." },
  ];
  for (const c of reproc) {
    await prisma.refReprocessingClass.upsert({
      where: { code: c.code },
      update: { ...c, ruleSetId: "rs-krinko" },
      create: { ...c, ruleSetId: "rs-krinko" },
    });
  }

  const equipment = [
    {
      code: "rdg",
      label: "Reinigungs- und Desinfektionsgerät (Thermodesinfektor, RDG)",
      equipmentStandard: "DIN EN ISO 15883-1 und -2",
      validationStandard: "DIN EN ISO 15883 · Leitlinie DGKH/DGSV/AKI",
      revalidationMonths: 12,
      intervalDisputed: false,
      intervalSource: "Norm und Leitlinie: mindestens jährlich",
      routineChecks: JSON.stringify([
        "Arbeitstäglich: Sichtprüfung von Siebkörben, Düsen und Sprüharmen",
        "Chargenbezogen: Prozessprotokoll mit Temperatur-Zeit-Verlauf",
      ]),
      releaseRule: "Chargenfreigabe durch sachkundige Person anhand des Prozessprotokolls",
    },
    {
      code: "klein",
      label: "Kleinsterilisator, Dampf (unter 1 Sterilisationseinheit)",
      equipmentStandard: "DIN EN 13060 — Typ B, N oder S",
      validationStandard: "DIN EN ISO 17665 · DIN SPEC 58929",
      revalidationMonths: 12,
      intervalDisputed: true,
      intervalSource: "Quellen weichen ab: überwiegend jährlich, teilweise zweijährig",
      routineChecks: JSON.stringify(["Arbeitstäglich: Vakuumtest und Dampfdurchdringungstest"]),
      releaseRule: "Chargenfreigabe nach Prüfung von Protokoll und Indikator",
    },
    {
      code: "gross",
      label: "Dampfsterilisator ab 1 Sterilisationseinheit",
      equipmentStandard: "DIN EN 285",
      validationStandard: "DIN EN ISO 17665 · Leitlinie DGKH/DGSV/AKI",
      revalidationMonths: 12,
      intervalDisputed: false,
      intervalSource: "DIN EN ISO 17665-1: jährlich empfohlen",
      routineChecks: JSON.stringify(["Arbeitstäglich: Vakuumtest und Bowie-Dick-Test"]),
      releaseRule: "Chargenfreigabe durch sachkundige Person, dokumentiert",
    },
    {
      code: "siegel",
      label: "Folienschweißgerät (Siegelgerät)",
      equipmentStandard: "DIN EN ISO 11607-1 · DIN 58953-7",
      validationStandard: "DIN EN ISO 11607-2",
      revalidationMonths: 12,
      intervalDisputed: false,
      intervalSource: "erneute Leistungsqualifikation mit Siegelnahtfestigkeitsprüfung",
      routineChecks: JSON.stringify(["Arbeitstäglich: Siegelnahtprüfung (Seal-Check oder Tintentest)"]),
      releaseRule: "Sichtprüfung und Dokumentation der Siegelparameter vor Arbeitsbeginn",
    },
  ];
  for (const e of equipment) {
    await prisma.refReprocessingEquipmentType.upsert({
      where: { code: e.code },
      update: { ...e, ruleSetId: "rs-normen" },
      create: { ...e, ruleSetId: "rs-normen" },
    });
  }

  for (const r of [
    { code: "roentgen", label: "Röntgendiagnostik", defaultAuthorisation: "notification", medicalBoardNote: "in der Regel alle zwei bis drei Jahre" },
    { code: "therapie", label: "Strahlentherapie", defaultAuthorisation: "licence", medicalBoardNote: "engmaschiger als in der Diagnostik" },
    { code: "nuklear", label: "Nuklearmedizin — Umgang mit radioaktiven Stoffen", defaultAuthorisation: "licence", medicalBoardNote: "engmaschiger als in der Diagnostik" },
  ]) {
    await prisma.refRadiationApplication.upsert({
      where: { code: r.code },
      update: { ...r, ruleSetId: "rs-strlschv" },
      create: { ...r, ruleSetId: "rs-strlschv" },
    });
  }

  for (const c of [
    { code: "aufnahme", label: "Aufnahmeeinrichtung", defaultCadence: "monatlich" },
    { code: "durchl", label: "Durchleuchtungseinrichtung", defaultCadence: "monatlich" },
    { code: "monitor", label: "Befundungsmonitor und Betrachtungsbedingungen", defaultCadence: "arbeitstaeglich" },
    { code: "digital", label: "Digitale Bildverarbeitung und Ausgabemedien", defaultCadence: "arbeitstaeglich" },
    { code: "dosis", label: "Dosisanzeige und Dosisflächenprodukt", defaultCadence: "jaehrlich" },
  ]) {
    await prisma.refConstancyObject.upsert({
      where: { code: c.code },
      update: { ...c, ruleSetId: "rs-strlschv" },
      create: { ...c, ruleSetId: "rs-strlschv" },
    });
  }

  for (const t of [
    {
      code: "einweisung4",
      label: "Einweisung in die Handhabung",
      legalBasis: "§ 4 Absatz 3 MPBetreibV",
      subjectKind: "model",
      validityMonths: null as number | null,
      chainAllowed: false,
      note: "Vor der ersten Anwendung und erneut nach jeder wesentlichen Aktualisierung.",
    },
    {
      code: "einweisung11",
      label: "Einweisung in aktive Produkte",
      legalBasis: "§ 11 MPBetreibV",
      subjectKind: "model",
      validityMonths: null,
      chainAllowed: true,
      note: "Anhand der Gebrauchsanweisung durch den Hersteller oder Beauftragte.",
    },
    {
      code: "unterweisungStrl",
      label: "Unterweisung Strahlenschutz",
      legalBasis: "§ 63 StrlSchV",
      subjectKind: "activity",
      validityMonths: 12,
      chainAllowed: false,
      note: "Vor Aufnahme der Tätigkeit und danach regelmäßig zu wiederholen.",
    },
    {
      code: "sachkundeAufb",
      label: "Schulung Aufbereitung",
      legalBasis: "§ 8 MPBetreibV · KRINKO/BfArM",
      subjectKind: "activity",
      validityMonths: 24,
      chainAllowed: false,
      note: "Umfang richtet sich nach der Einstufung der aufzubereitenden Produkte.",
    },
  ]) {
    await prisma.refTrainingType.upsert({
      where: { code: t.code },
      update: { ...t, ruleSetId: "rs-mpbetreibv" },
      create: { ...t, ruleSetId: "rs-mpbetreibv" },
    });
  }

  for (const pk of PRODUCT_KINDS) {
    await prisma.refProductKind.upsert({
      where: { code: pk.code },
      update: {
        label: pk.label,
        hint: pk.hint,
        sortGroup: pk.sortGroup,
        shows: JSON.stringify(pk.shows),
        blocks: JSON.stringify(pk.blocks),
        presets: JSON.stringify(pk.presets),
      },
      create: {
        code: pk.code,
        label: pk.label,
        hint: pk.hint,
        sortGroup: pk.sortGroup,
        shows: JSON.stringify(pk.shows),
        blocks: JSON.stringify(pk.blocks),
        presets: JSON.stringify(pk.presets),
      },
    });
  }
}
